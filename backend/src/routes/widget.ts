// Public website-chat-widget API. Mounted BEFORE the auth wall and with its OWN
// permissive CORS (customer sites live on arbitrary origins the global allowlist
// rejects). No auth: a visitor is identified only by a random visitorId their browser
// keeps in localStorage. Transport is polling (GET /messages) — deliberately not
// Socket.io, whose CORS is server-global and would loosen the whole CRM.

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS, emitScoped, getIo } from '../socket';
import { entitlementsFor } from '../lib/entitlements';
import { logActivity } from '../lib/activity';
import { pickRoundRobinAssignee } from '../lib/assignment';
import { handleInboundAutoReply } from '../lib/autoReply';
import { notifyLeadEvent } from '../lib/push';
import { classifyOptMessage, handleOptChange } from '../lib/optOut';
import { rateLimited } from '../lib/rateLimit';

export const widgetRouter = Router();

export interface WidgetConfig { title: string; greeting: string; color: string }
const DEFAULT_CONFIG: WidgetConfig = { title: 'צ׳אט עם נציג', greeting: 'שלום! איך נוכל לעזור? 🙂', color: '#25D366' };

function configOf(json: unknown): WidgetConfig {
  const c = (json && typeof json === 'object' ? json : {}) as Partial<WidgetConfig>;
  return {
    title: (c.title || DEFAULT_CONFIG.title).slice(0, 60),
    greeting: (c.greeting || DEFAULT_CONFIG.greeting).slice(0, 300),
    color: /^#[0-9a-fA-F]{6}$/.test(c.color || '') ? c.color! : DEFAULT_CONFIG.color,
  };
}


// Resolve the tenant for a widget key, enforcing enabled + plan feature. Returns null
// (→ generic 404) rather than leaking why, so the key can't be probed.
async function resolveWidgetTenant(key: unknown) {
  if (typeof key !== 'string' || !key) return null;
  const t = await prisma.tenant.findFirst({
    where: { widgetKey: key, active: true },
    select: { id: true, widgetEnabled: true, widgetConfig: true, plan: true },
  });
  if (!t || !t.widgetEnabled || !entitlementsFor(t.plan).features.webchat) return null;
  return t;
}

const cleanVisitorId = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return s.length >= 8 ? s : null;
};

function mapMsg(m: { id: string; content: string; direction: string; type: string; mediaUrl: string | null; timestamp: Date }) {
  return { id: m.id, content: m.content, direction: m.direction, type: m.type, mediaUrl: m.mediaUrl, timestamp: m.timestamp.toISOString() };
}

// ─── POST /widget/session ─────────────────────────────────────────────────────
// Start (or resume) a visitor's conversation. Upserts a WEBCHAT lead keyed by
// (tenant, visitorId) and returns the appearance config + message history.
widgetRouter.post('/session', async (req: Request, res: Response) => {
  try {
    // The widgetKey is public by design (embedded in the customer's page source), so
    // /session must defend itself: per-IP throttle + the plan's lead cap. Without
    // them, anyone who viewed the page source could mint unbounded WEBCHAT leads.
    if (rateLimited(`sess|${req.ip ?? 'ip'}`, 10, 60_000)) {
      return res.status(429).json({ error: 'יותר מדי בקשות — נסה שוב בעוד רגע' });
    }

    const tenant = await resolveWidgetTenant(req.body?.key);
    if (!tenant) return res.status(404).json({ error: 'widget not found' });
    const visitorId = cleanVisitorId(req.body?.visitorId);
    if (!visitorId) return res.status(400).json({ error: 'bad visitor' });

    const existing = await prisma.lead.findFirst({ where: { tenantId: tenant.id, channel: 'WEBCHAT', externalId: visitorId } });
    if (!existing) {
      // New visitor → this creates a lead: enforce the tenant plan's lead cap (the
      // authenticated routes enforce it via checkLimit; the public widget must too).
      const maxLeads = entitlementsFor(tenant.plan).maxLeads;
      if (Number.isFinite(maxLeads)) {
        const used = await prisma.lead.count({ where: { tenantId: tenant.id } });
        if (used >= (maxLeads as number)) return res.status(404).json({ error: 'widget not found' });
      }
    }
    const name = String(req.body?.name ?? '').trim().slice(0, 80) || existing?.name || 'אורח מהאתר';
    const phoneNote = String(req.body?.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20);

    const autoAssignee = !existing ? await pickRoundRobinAssignee(tenant.id) : null;
    const lead = await prisma.lead.upsert({
      where: { tenantId_channel_externalId: { tenantId: tenant.id, channel: 'WEBCHAT', externalId: visitorId } },
      update: { name },
      create: {
        tenantId: tenant.id, channel: 'WEBCHAT', externalId: visitorId, name,
        // Phone is optional for webchat; when provided we keep it as a note to avoid
        // colliding on the (tenant, phone) unique used by WhatsApp leads.
        internalNotes: phoneNote ? `טלפון מהאתר: ${phoneNote}` : null,
        ...(autoAssignee ? { assignedTo: autoAssignee } : {}),
      },
    });
    if (!existing) {
      await logActivity(lead.id, tenant.id, 'ליד נוצר', 'נוצר מצ׳אט באתר');
      const io = getIo();
      if (io) emitScoped(io, tenant.id, lead.assignedTo, SOCKET_EVENTS.LEAD_CREATED, lead);
    }

    const messages = await prisma.message.findMany({ where: { leadId: lead.id, tenantId: tenant.id }, orderBy: { timestamp: 'asc' }, take: 100 });
    // The credit line doubles as this product's cheapest acquisition channel, so it
    // stays on every tier that hasn't paid to remove it.
    const branded = !entitlementsFor(tenant.plan).features.whiteLabel;
    return res.json({
      leadId: lead.id,
      config: { ...configOf(tenant.widgetConfig), branded },
      messages: messages.map(mapMsg),
    });
  } catch (error) {
    console.error('POST /widget/session error:', error);
    return res.status(500).json({ error: 'server error' });
  }
});

// ─── POST /widget/message ─────────────────────────────────────────────────────
// A visitor sends a message. Stored as an inbound WEBCHAT message; surfaces in the
// CRM inbox in realtime and triggers auto-replies just like a WhatsApp inbound.
widgetRouter.post('/message', async (req: Request, res: Response) => {
  try {
    const tenant = await resolveWidgetTenant(req.body?.key);
    if (!tenant) return res.status(404).json({ error: 'widget not found' });
    const visitorId = cleanVisitorId(req.body?.visitorId);
    if (!visitorId) return res.status(400).json({ error: 'bad visitor' });

    // Two layers: per-visitor (10/min — a human chatting) and per-IP regardless of
    // visitorId (30/min — rotating visitorIds must not bypass the limit).
    if (rateLimited(`${req.ip ?? 'ip'}|${visitorId}`, 10)) return res.status(429).json({ error: 'שלחת יותר מדי הודעות — נסה שוב בעוד רגע' });
    if (rateLimited(`msg|${req.ip ?? 'ip'}`, 30, 60_000)) return res.status(429).json({ error: 'שלחת יותר מדי הודעות — נסה שוב בעוד רגע' });

    const content = String(req.body?.content ?? '').trim().slice(0, 4000);
    if (!content) return res.status(400).json({ error: 'empty' });

    const lead = await prisma.lead.findFirst({ where: { tenantId: tenant.id, channel: 'WEBCHAT', externalId: visitorId } });
    if (!lead) return res.status(404).json({ error: 'no session' });

    const priorCount = await prisma.message.count({ where: { leadId: lead.id, tenantId: tenant.id, direction: 'inbound' } });

    const message = await prisma.message.create({
      data: { tenantId: tenant.id, leadId: lead.id, content, type: 'text', direction: 'inbound', status: 'delivered' },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { lastMessageAt: new Date() } });

    const io = getIo();
    if (io) {
      emitScoped(io, tenant.id, lead.assignedTo, SOCKET_EVENTS.NEW_MESSAGE, message);
      emitScoped(io, tenant.id, lead.assignedTo, SOCKET_EVENTS.LEAD_UPDATED, { ...lead, lastMessageAt: new Date() });
    }

    // Opt-out command → handle + skip the normal auto-reply; otherwise run auto-replies.
    const optKind = classifyOptMessage(content);
    if (optKind) void handleOptChange(tenant.id, lead.id, optKind);
    else void handleInboundAutoReply({ tenantId: tenant.id, lead: { id: lead.id, lastAutoReplyAt: lead.lastAutoReplyAt, channel: 'WEBCHAT' }, isNewLead: priorCount === 0 });
    void notifyLeadEvent(tenant.id, lead.assignedTo, { title: `${lead.name} (אתר)`, body: content, leadId: lead.id });

    return res.json({ ok: true, message: mapMsg(message) });
  } catch (error) {
    console.error('POST /widget/message error:', error);
    return res.status(500).json({ error: 'server error' });
  }
});

// ─── GET /widget/messages ─────────────────────────────────────────────────────
// Poll for new messages (agent replies + the visitor's own, for multi-tab). `after`
// is an ISO timestamp cursor.
widgetRouter.get('/messages', async (req: Request, res: Response) => {
  try {
    // Unauthenticated + two DB queries per call; the client polls every 4s. Cap per IP
    // so a public widgetKey can't be used to hammer the DB (90/min ≈ 4s polling ×
    // several tabs, well clear of legitimate use).
    if (rateLimited(`poll|${req.ip ?? 'ip'}`, 90, 60_000)) return res.status(429).json([]);

    const tenant = await resolveWidgetTenant(req.query?.key);
    if (!tenant) return res.status(404).json({ error: 'widget not found' });
    const visitorId = cleanVisitorId(req.query?.visitorId);
    if (!visitorId) return res.status(400).json({ error: 'bad visitor' });

    const lead = await prisma.lead.findFirst({ where: { tenantId: tenant.id, channel: 'WEBCHAT', externalId: visitorId }, select: { id: true } });
    if (!lead) return res.json([]);

    const after = typeof req.query.after === 'string' ? new Date(req.query.after) : null;
    const messages = await prisma.message.findMany({
      where: { leadId: lead.id, tenantId: tenant.id, ...(after && !isNaN(after.getTime()) ? { timestamp: { gt: after } } : {}) },
      orderBy: { timestamp: 'asc' },
      take: 50,
    });
    return res.json(messages.map(mapMsg));
  } catch (error) {
    console.error('GET /widget/messages error:', error);
    return res.status(500).json({ error: 'server error' });
  }
});
