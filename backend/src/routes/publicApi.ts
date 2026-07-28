// The public REST API — what the PRO plan's "API access" actually means.
//
// Versioned under /api/v1 so the shape can evolve without breaking an integration a
// customer wired up months ago. Authenticated by API key, never by session JWT: the
// callers are servers (Make, Zapier, a customer's own backend), not browsers.
//
// The original motivation is Facebook Lead Ads: a form submission reaches Make, Make
// POSTs it here, and the lead lands in the inbox with round-robin assignment and the
// tenant's auto-replies already applied — no Meta app or app review required on our
// side, because the customer's own Make account owns that integration.

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS, emitScoped, getIo } from '../socket';
import { entitlementsFor } from '../lib/entitlements';
import { logActivity } from '../lib/activity';
import { pickRoundRobinAssignee } from '../lib/assignment';
import { rateLimited } from '../lib/rateLimit';
import { normalizePhone } from './leads';
import type { LeadChannel, Priority } from '@prisma/client';

export const publicApiRouter = Router();

const CHANNELS = new Set(['WHATSAPP', 'WEBCHAT', 'INSTAGRAM', 'MESSENGER']);
const PRIORITIES = new Set(['Low', 'Med', 'High']);

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

// ─── GET /api/v1/leads ───────────────────────────────────────────────────────
publicApiRouter.get('/leads', async (req: Request, res: Response) => {
  const tenantId = req.apiTenantId!;
  if (rateLimited(`api-read|${tenantId}`, 120)) {
    return res.status(429).json({ error: 'Rate limit exceeded (120 requests/minute).' });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const status = str(req.query.status, 20);
  const since = req.query.since ? new Date(String(req.query.since)) : null;
  if (since && Number.isNaN(since.getTime())) {
    return res.status(400).json({ error: '`since` must be an ISO 8601 timestamp.' });
  }

  const leads = await prisma.lead.findMany({
    where: {
      tenantId,
      ...(status ? { status: status as never } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, name: true, phone: true, email: true, company: true, channel: true,
      status: true, priority: true, assignedTo: true, tags: true, attributes: true,
      lastMessageAt: true, createdAt: true,
    },
  });
  return res.json({ data: leads, count: leads.length });
});

// ─── POST /api/v1/leads ──────────────────────────────────────────────────────
publicApiRouter.post('/leads', async (req: Request, res: Response) => {
  const tenantId = req.apiTenantId!;
  if (rateLimited(`api-write|${tenantId}`, 60)) {
    return res.status(429).json({ error: 'Rate limit exceeded (60 writes/minute).' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = str(body.name, 80);
  if (!name) return res.status(400).json({ error: '`name` is required.' });

  const rawChannel = str(body.channel, 20)?.toUpperCase() ?? 'WHATSAPP';
  if (!CHANNELS.has(rawChannel)) {
    return res.status(400).json({ error: `\`channel\` must be one of: ${[...CHANNELS].join(', ')}.` });
  }
  const channel = rawChannel as LeadChannel;

  const rawPhone = str(body.phone, 30);
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const externalId = str(body.externalId, 120);

  // Identity rules mirror the schema's two unique keys: WhatsApp leads are keyed by
  // phone, every other channel by (channel, externalId). Without one of them there is
  // no way to recognise the same person twice, and every retry would create a duplicate.
  if (channel === 'WHATSAPP' && !phone) {
    return res.status(400).json({ error: '`phone` is required for WHATSAPP leads.' });
  }
  if (channel !== 'WHATSAPP' && !externalId) {
    return res.status(400).json({ error: '`externalId` is required for non-WhatsApp channels.' });
  }

  const priority = str(body.priority, 10);
  if (priority && !PRIORITIES.has(priority)) {
    return res.status(400).json({ error: '`priority` must be Low, Med or High.' });
  }
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 20)
    : [];

  const where = channel === 'WHATSAPP'
    ? { tenantId_phone: { tenantId, phone: phone! } }
    : { tenantId_channel_externalId: { tenantId, channel, externalId: externalId! } };

  const existing = await prisma.lead.findUnique({ where });

  // A new lead consumes plan quota; an update to an existing one does not. Same rule
  // the widget and the authenticated routes enforce — the API must not be the way
  // around a plan limit.
  if (!existing) {
    const maxLeads = entitlementsFor((await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }))!.plan).maxLeads;
    if (Number.isFinite(maxLeads)) {
      const used = await prisma.lead.count({ where: { tenantId } });
      if (used >= (maxLeads as number)) {
        return res.status(402).json({ error: 'Plan lead limit reached.', upgrade: true, cap: maxLeads, used });
      }
    }
  }

  const assignedTo = str(body.assignedTo, 60) ?? (!existing ? await pickRoundRobinAssignee(tenantId) : null);
  const source = str(body.source, 40);

  const lead = await prisma.lead.upsert({
    where,
    // Re-posting a known contact enriches it rather than overwriting: an integration
    // that resends a form with a blank field must not wipe data an agent typed in.
    update: {
      name,
      ...(str(body.email, 120) ? { email: str(body.email, 120) } : {}),
      ...(str(body.company, 80) ? { company: str(body.company, 80) } : {}),
      ...(priority ? { priority: priority as Priority } : {}),
      ...(tags.length ? { tags } : {}),
    },
    create: {
      tenantId,
      name,
      channel,
      phone,
      externalId,
      email: str(body.email, 120),
      company: str(body.company, 80),
      priority: (priority as Priority) ?? undefined,
      tags,
      internalNotes: source ? `מקור: ${source}` : null,
      ...(assignedTo ? { assignedTo } : {}),
    },
  });

  if (!existing) {
    await logActivity(lead.id, tenantId, 'ליד נוצר', source ? `נוצר דרך API (${source})` : 'נוצר דרך API');
    const io = getIo();
    if (io) emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.LEAD_CREATED, lead);
  }

  return res.status(existing ? 200 : 201).json({
    data: { id: lead.id, name: lead.name, phone: lead.phone, channel: lead.channel, status: lead.status, assignedTo: lead.assignedTo },
    created: !existing,
  });
});
