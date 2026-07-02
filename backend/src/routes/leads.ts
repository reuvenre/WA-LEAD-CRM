import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { LeadStatus, Priority } from '@prisma/client';
import { SOCKET_EVENTS, emitScoped } from '../socket';
import { Server as SocketIOServer } from 'socket.io';
import { leadScope, canAccessLead, isManager } from '../middleware/auth';
import { logActivity } from '../lib/activity';
import { triggerAutomations } from '../lib/automations';
import { syncLeadMeeting } from '../lib/google';

export const leadsRouter = Router();

// ─── GET /leads ───────────────────────────────────────────────────────────────
leadsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, search, tags, projectId, page = '1', limit = '50' } = req.query;
    // Clamp pagination so a huge/negative/NaN limit can't run an unbounded query or 500.
    const take = Math.min(Math.max(parseInt(limit as string) || 50, 1), 100);
    const pageN = Math.max(parseInt(page as string) || 1, 1);
    const skip = (pageN - 1) * take;

    // Agents only see their own conversations; managers see the whole tenant.
    const where: Record<string, unknown> = { tenantId, ...leadScope(req) };

    if (status && status !== 'all') where.status = status as LeadStatus;
    if (tags) where.tags = { hasSome: (tags as string).split(',') };
    if (projectId) where.projectId = projectId as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take,
        include: { messages: { orderBy: { timestamp: 'desc' }, take: 1 }, project: true },
      }),
      prisma.lead.count({ where }),
    ]);

    return res.json({ leads, total, page: pageN });
  } catch (error) {
    console.error('GET /leads error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leads/calendar?month=2026-04
leadsRouter.get('/calendar', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'פורמט חודש שגוי (YYYY-MM)' });
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        ...leadScope(req),
        meetingDate: { gte: start, lt: end },
      },
      select: {
        id: true, name: true, phone: true, status: true,
        meetingDate: true, meetingNotes: true, assignedTo: true,
        project: { select: { name: true, color: true } },
      },
      orderBy: { meetingDate: 'asc' },
    });

    return res.json(leads);
  } catch (error) {
    console.error('GET /leads/calendar error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /leads/:id ───────────────────────────────────────────────────────────
leadsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        messages: { orderBy: { timestamp: 'asc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        project: true,
      },
    });

    // Don't reveal another agent's lead — 404 (not 403) so existence isn't leaked.
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });
    return res.json(lead);
  } catch (error) {
    console.error('GET /leads/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /leads/:id ────────────────────────────────────────────────────────
leadsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, email, company, status, priority, internalNotes, assignedTo, tags, projectId, meetingDate, meetingNotes } = req.body;

    const current = await prisma.lead.findFirst({ where: { id: req.params.id, tenantId } });
    if (!current || !canAccessLead(req, current.assignedTo)) return res.status(404).json({ error: 'Lead not found' });
    // An agent may not hand a lead to someone else (which would also hide it from them);
    // only managers can reassign.
    if (!isManager(req) && assignedTo !== undefined && assignedTo !== current.assignedTo) {
      return res.status(403).json({ error: 'רק מנהל יכול לשנות שיוך נציג' });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (company !== undefined) updateData.company = company;
    if (status !== undefined) {
      if (!Object.values(LeadStatus).includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });
      updateData.status = status as LeadStatus;
    }
    if (priority !== undefined) {
      if (!Object.values(Priority).includes(priority)) return res.status(400).json({ error: 'עדיפות לא תקינה' });
      updateData.priority = priority as Priority;
    }
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (tags !== undefined) updateData.tags = tags;
    if (projectId !== undefined) {
      if (projectId) {
        // Verify the project belongs to THIS tenant — Prisma's FK only checks existence,
        // so without this a lead could be linked to another tenant's project.
        const proj = await prisma.project.findFirst({ where: { id: projectId, tenantId } });
        if (!proj) return res.status(400).json({ error: 'פרויקט לא נמצא' });
        updateData.projectId = projectId;
      } else {
        updateData.projectId = null;
      }
    }
    if (meetingDate !== undefined) updateData.meetingDate = meetingDate ? new Date(meetingDate) : null;
    if (meetingNotes !== undefined) updateData.meetingNotes = meetingNotes;

    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: updateData });

    if (status && status !== current.status) {
      const statusLabels: Record<string, string> = {
        NEW: 'חדש', IN_PROGRESS: 'בטיפול', HOT: 'חם', CLOSED: 'סגור', LOST: 'הפסד',
      };
      await logActivity(lead.id, tenantId, 'שינוי סטטוס', `${statusLabels[current.status]} → ${statusLabels[status]}`);
      await triggerAutomations('lead.status_changed', { lead, previousStatus: current.status }, tenantId);
    }
    if (assignedTo && assignedTo !== current.assignedTo) {
      await logActivity(lead.id, tenantId, 'שיוך נציג', `הוקצה ל-${assignedTo}`);
    }
    if (tags && JSON.stringify(tags) !== JSON.stringify(current.tags)) {
      await logActivity(lead.id, tenantId, 'עדכון תגיות', `תגיות: ${(tags as string[]).join(', ')}`);
    }

    // Reflect meeting changes into the acting user's Google Calendar (one-way, fire-and-forget)
    if (meetingDate !== undefined) {
      void syncLeadMeeting(lead, req.user!.userId);
    }

    const io: SocketIOServer = req.app.get('io');
    // Notify managers + the (new) assignee. On reassignment also tell the previous
    // assignee's room (so the lead disappears for them) and push a lead:created to the
    // new assignee's room so it surfaces live in their list.
    emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.LEAD_UPDATED, lead);
    if (current.assignedTo && current.assignedTo !== lead.assignedTo) {
      emitScoped(io, tenantId, current.assignedTo, SOCKET_EVENTS.LEAD_UPDATED, lead);
    }
    if (lead.assignedTo && lead.assignedTo !== current.assignedTo) {
      emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.LEAD_CREATED, lead);
    }

    return res.json(lead);
  } catch (error) {
    console.error('PATCH /leads/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /leads — create single lead manually ───────────────────────────────
leadsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, phone, email, company, status, priority, assignedTo, internalNotes, tags } = req.body;

    if (!name || !phone) return res.status(400).json({ error: 'שם וטלפון הם שדות חובה' });
    if (status !== undefined && !Object.values(LeadStatus).includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });
    if (priority !== undefined && !Object.values(Priority).includes(priority)) return res.status(400).json({ error: 'עדיפות לא תקינה' });

    const normalizedPhone = normalizePhone(phone);

    const existing = await prisma.lead.findFirst({ where: { tenantId, phone: normalizedPhone } });
    if (existing) return res.status(409).json({ error: 'ליד עם מספר זה כבר קיים', lead: existing });

    // An agent's manually-created lead is auto-assigned to them (they can't create it
    // for another agent); a manager may assign freely.
    const finalAssignedTo = isManager(req) ? (assignedTo || null) : req.user!.username;

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name: name.trim(),
        phone: normalizedPhone,
        email: email?.trim() || null,
        company: company?.trim() || null,
        status: (status as LeadStatus) ?? 'NEW',
        priority: (priority as Priority) ?? 'Med',
        assignedTo: finalAssignedTo,
        internalNotes: internalNotes || null,
        tags: tags ?? [],
      },
    });

    await logActivity(lead.id, tenantId, 'ליד נוצר', 'נוצר ידנית');
    await triggerAutomations('lead.created', { lead }, tenantId);

    const io: SocketIOServer = req.app.get('io');
    emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.LEAD_CREATED, lead);

    return res.status(201).json(lead);
  } catch (error) {
    // Lost a race on the (tenantId, phone) unique constraint — report as a conflict, not a 500.
    if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'ליד עם מספר זה כבר קיים' });
    }
    console.error('POST /leads error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /leads/import ──────────────────────────────────────────────────────
leadsRouter.post('/import', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { leads: rows } = req.body as {
      leads: Array<{ name: string; phone: string; status?: string; priority?: string; assignedTo?: string; tags?: string }>
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'לא נשלחו נתונים לייבוא' });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      if (!row.name?.trim() || !row.phone?.trim()) {
        results.errors.push(`שורה ללא שם/טלפון: ${JSON.stringify(row)}`);
        continue;
      }

      const phone = normalizePhone(row.phone.trim());
      const tags = row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

      try {
        const existing = await prisma.lead.findFirst({ where: { tenantId, phone } });
        if (existing) { results.skipped++; continue; }

        const lead = await prisma.lead.create({
          data: {
            tenantId,
            name: row.name.trim(),
            phone,
            status: (row.status as LeadStatus) ?? 'NEW',
            priority: (row.priority as Priority) ?? 'Med',
            assignedTo: row.assignedTo?.trim() || null,
            tags,
          },
        });

        await logActivity(lead.id, tenantId, 'ליד נוצר', 'יובא מקובץ');
        results.created++;
      } catch (err) {
        // P2002 = duplicate phone (lost the race) → treat as skipped; anything else is a real error.
        if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') {
          results.skipped++;
        } else {
          results.errors.push(`שגיאה בשורה ${row.phone}: ${String(err)}`);
        }
      }
    }

    return res.json(results);
  } catch (error) {
    console.error('POST /leads/import error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /leads/:id ───────────────────────────────────────────────────────
leadsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, tenantId } });
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });
    await prisma.lead.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /leads/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
// Normalizes to an international number WITHOUT a leading '+'. Numbers entered with an
// explicit international prefix ('+' or '00') keep their own country code; bare local
// numbers (leading '0') and digit-only input default to Israel (972).
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return digits;

  // Explicit international form: +<cc>... or 00<cc>...
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);

  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return '972' + digits;
}
