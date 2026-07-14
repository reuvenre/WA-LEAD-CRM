// Import existing WhatsApp data into the CRM.
//
// Two operations, matching the product decision (on-demand per chat):
//   POST /contacts        — bulk-create a lead per WhatsApp contact (manager only)
//   POST /history/:leadId — pull one chat's past messages into that lead (on demand)
//
// Both are READS against the provider and never send anything, so they don't touch the
// anti-ban daily send cap. Contacts import respects the plan's lead cap.

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS, emitScoped } from '../socket';
import { Server as SocketIOServer } from 'socket.io';
import { isManager, canAccessLead } from '../middleware/auth';
import { getProvider, resolveCreds } from '../lib/messaging';
import { entitlementsFor } from '../lib/entitlements';
import { logActivity } from '../lib/activity';

export const waImportRouter = Router();

// Tenant-level Green API creds (the account we pull contacts/history from). Contacts
// aren't tied to a single line, so this always uses the tenant instance.
async function tenantCreds(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { greenApiInstanceId: true, greenApiToken: true, plan: true },
  });
}

// ─── GET /wa-import/account ───────────────────────────────────────────────────
// The connected WhatsApp number the import will pull from (so the UI can show it).
waImportRouter.get('/account', async (req: Request, res: Response) => {
  try {
    if (!isManager(req)) return res.status(403).json({ error: 'רק מנהל יכול לצפות בחשבון' });
    const tenant = await tenantCreds(req.user!.tenantId);
    const creds = resolveCreds(null, tenant);
    if (creds.provider !== 'GREEN_API' || !creds.greenApiInstanceId || !creds.greenApiToken) {
      return res.json({ connected: false, phone: null, state: null });
    }
    const r = await fetch(
      `https://api.green-api.com/waInstance${creds.greenApiInstanceId}/getWaSettings/${encodeURIComponent(creds.greenApiToken)}`,
      { method: 'GET', signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return res.json({ connected: false, phone: null, state: null });
    const data = await r.json() as { phone?: string; stateInstance?: string };
    const phone = data.phone ? String(data.phone).replace(/\D/g, '') : null;
    return res.json({ connected: data.stateInstance === 'authorized', phone, state: data.stateInstance ?? null });
  } catch {
    return res.json({ connected: false, phone: null, state: null });
  }
});

// ─── POST /wa-import/contacts ─────────────────────────────────────────────────
// Pull the account's contact list and create a lead for each new one. Existing leads
// (matched by phone) are left untouched. Stops at the plan's lead cap.
waImportRouter.post('/contacts', async (req: Request, res: Response) => {
  try {
    // Bulk-creating leads across the whole tenant is a manager action.
    if (!isManager(req)) return res.status(403).json({ error: 'רק מנהל יכול לייבא אנשי קשר' });

    const tenantId = req.user!.tenantId;
    const tenant = await tenantCreds(tenantId);
    const creds = resolveCreds(null, tenant);

    const result = await getProvider(creds.provider).listContacts(creds);
    if (!result.success || !result.contacts) {
      return res.status(502).json({ error: result.error || 'שליפת אנשי הקשר נכשלה' });
    }

    // Remaining capacity under the plan's lead cap (Infinity → unlimited).
    const cap = entitlementsFor(tenant?.plan ?? 'TRIAL').maxLeads;
    const used = await prisma.lead.count({ where: { tenantId } });
    let remaining = cap === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Math.max(0, cap - used);

    // Which phones already exist? One query instead of N lookups.
    const existing = new Set(
      (await prisma.lead.findMany({ where: { tenantId }, select: { phone: true } })).map((l) => l.phone),
    );

    let created = 0;
    let skipped = 0;
    let capReached = false;
    // Guard against a contact list that carries the same number twice.
    const seen = new Set<string>();

    for (const contact of result.contacts) {
      if (seen.has(contact.phone)) continue;
      seen.add(contact.phone);

      if (existing.has(contact.phone)) { skipped++; continue; }
      if (remaining <= 0) { capReached = true; break; }

      try {
        const lead = await prisma.lead.create({
          data: { tenantId, name: contact.name, phone: contact.phone },
        });
        await logActivity(lead.id, tenantId, 'ליד נוצר', 'יובא מאנשי הקשר של וואטסאפ');
        created++;
        if (remaining !== Number.POSITIVE_INFINITY) remaining--;
      } catch (err) {
        // Lost the race on (tenantId, phone) — count as skipped, not an error.
        if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') skipped++;
        else throw err;
      }
    }

    // The importing manager refreshes their list from this response; we deliberately
    // don't emit per-lead socket events for a bulk import (could be hundreds at once).
    return res.json({ created, skipped, total: result.contacts.length, capReached });
  } catch (error) {
    console.error('POST /wa-import/contacts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /wa-import/history/:leadId ──────────────────────────────────────────
// Pull one chat's past messages into the CRM. Idempotent: messages already stored
// (matched by provider idMessage) are skipped, so re-clicking only adds what's new.
waImportRouter.post('/history/:leadId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const leadId = req.params.leadId;

    // Send from the number this conversation belongs to (line creds → tenant fallback).
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId }, include: { line: true } });
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });

    const phone = (lead.phone ?? '').replace(/\D/g, '');
    if (!phone) return res.status(400).json({ error: 'לליד אין מספר טלפון תקין — לא ניתן לטעון היסטוריה' });

    // How many messages back to pull (default 100, capped so a huge value can't hang).
    const requested = parseInt(String(req.body?.count ?? ''), 10);
    const count = Math.min(Math.max(Number.isFinite(requested) ? requested : 100, 1), 500);

    const creds = resolveCreds(lead.line, await tenantCreds(tenantId));
    const result = await getProvider(creds.provider).getChatHistory(creds, phone, count);
    if (!result.success || !result.messages) {
      return res.status(502).json({ error: result.error || 'טעינת ההיסטוריה נכשלה' });
    }

    // Dedup against what we already have for this lead: by provider id where present,
    // and by (content|timestamp) for older messages that predate externalId tracking.
    const existing = await prisma.message.findMany({
      where: { leadId, tenantId },
      select: { externalId: true, content: true, timestamp: true },
    });
    const seenIds = new Set(existing.map((m) => m.externalId).filter(Boolean) as string[]);
    const seenFallback = new Set(existing.map((m) => `${m.content}|${m.timestamp.getTime()}`));

    let imported = 0;
    let newest: Date | null = null;

    // Green API returns newest-first; insert oldest-first so timestamps read naturally.
    for (const msg of [...result.messages].reverse()) {
      if (msg.externalId && seenIds.has(msg.externalId)) continue;
      const fallbackKey = `${msg.content}|${msg.timestamp.getTime()}`;
      if (!msg.externalId && seenFallback.has(fallbackKey)) continue;

      await prisma.message.create({
        data: {
          tenantId,
          leadId,
          content: msg.content,
          type: msg.type,
          mediaUrl: msg.mediaUrl,
          fileName: msg.fileName,
          direction: msg.direction,
          status: msg.direction === 'inbound' ? 'delivered' : 'sent',
          externalId: msg.externalId,
          timestamp: msg.timestamp,
        },
      });
      if (msg.externalId) seenIds.add(msg.externalId);
      seenFallback.add(fallbackKey);
      imported++;
      if (!newest || msg.timestamp > newest) newest = msg.timestamp;
    }

    // Surface the chat in the list at the right spot if history is newer than what we knew.
    if (newest && (!lead.lastMessageAt || newest > lead.lastMessageAt)) {
      const updated = await prisma.lead.update({ where: { id: leadId }, data: { lastMessageAt: newest } });
      const io: SocketIOServer = req.app.get('io');
      emitScoped(io, tenantId, updated.assignedTo, SOCKET_EVENTS.LEAD_UPDATED, updated);
    }

    if (imported > 0) {
      await logActivity(leadId, tenantId, 'היסטוריה יובאה', `${imported} הודעות נטענו מוואטסאפ`);
    }

    return res.json({ imported, skipped: result.messages.length - imported, total: result.messages.length });
  } catch (error) {
    console.error('POST /wa-import/history/:leadId error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
