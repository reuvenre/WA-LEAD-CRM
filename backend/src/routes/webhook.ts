import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS, emitScoped } from '../socket';
import { Server as SocketIOServer } from 'socket.io';
import { logActivity } from '../lib/activity';
import { pickRoundRobinAssignee } from '../lib/assignment';
import { handleInboundAutoReply } from '../lib/autoReply';
import { triggerAutomations } from '../lib/automations';
import { notifyLeadEvent } from '../lib/push';
import { classifyOptMessage, handleOptChange } from '../lib/optOut';
import { tryCaptureCsatAnswer } from '../lib/csat';

export const webhookRouter = Router();

// Verify the shared secret embedded in the webhook URL (?token=…). Once a tenant has
// a secret, forged payloads (from anyone who merely knows the numeric instanceId) are
// rejected. Legacy tenants without a secret are allowed for backward-compat until they
// re-save Green API settings (which mints + activates the secret). Constant-time compare.
function webhookAuthorized(req: Request, secret: string | null): boolean {
  if (!secret) return true; // not yet configured — don't break the live webhook
  const provided = String(req.query.token ?? '');
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── Shared processing logic ──────────────────────────────────────────────────
async function processWebhook(req: Request, res: Response, tenantId: string, tenantName: string, lineId: string | null = null) {
  const body = req.body;
  const typeWebhook = body?.typeWebhook;

  // Delivery/read receipts: update the matching outbound message's status so the
  // chat shows ✓ → ✓✓ → ✓✓ (blue). Matched by Green API idMessage (externalId).
  if (typeWebhook === 'outgoingMessageStatus') {
    const idMessage: string = body?.idMessage ?? '';
    const statusMap: Record<string, 'sent' | 'delivered' | 'read'> = { sent: 'sent', delivered: 'delivered', read: 'read' };
    const newStatus = statusMap[body?.status as string];
    if (idMessage && newStatus) {
      const msg = await prisma.message.findFirst({ where: { tenantId, externalId: idMessage }, include: { lead: true } });
      const rank = { sent: 1, delivered: 2, read: 3 } as const;
      if (msg && rank[newStatus] > rank[(msg.status as 'sent' | 'delivered' | 'read')]) {
        const updated = await prisma.message.update({ where: { id: msg.id }, data: { status: newStatus } });
        const io: SocketIOServer = req.app.get('io');
        emitScoped(io, tenantId, msg.lead?.assignedTo, SOCKET_EVENTS.MESSAGE_STATUS, { id: updated.id, leadId: updated.leadId, status: updated.status });
      }
      // Reflect delivery/read into any campaign recipient sent with this provider id,
      // so the campaign results screen shows delivered/read counts.
      await prisma.campaignRecipient.updateMany({ where: { messageId: idMessage }, data: { status: newStatus } }).catch(() => {});
    }
    return res.status(200).json({ received: true });
  }

  // Handle both directions: an inbound message, AND a message the user sent from
  // their phone (outgoingMessageReceived) so phone replies show up in the CRM.
  // We deliberately ignore outgoingAPIMessageReceived — those were sent via our
  // own /messages/send and are already stored, so handling them would duplicate.
  const isIncoming = typeWebhook === 'incomingMessageReceived';
  const isOutgoing = typeWebhook === 'outgoingMessageReceived';
  if (!isIncoming && !isOutgoing) {
    return res.status(200).json({ received: true });
  }

  const messageData = body?.messageData;
  const senderData = body?.senderData;
  if (!messageData || !senderData) return res.status(200).json({ received: true });

  const chatId: string = senderData.chatId ?? '';
  const phone = chatId.replace('@c.us', '').replace('@g.us', '');

  // Skip group messages
  if (!phone || chatId.includes('@g.us')) return res.status(200).json({ received: true });

  // Outgoing payloads don't carry the chat partner's name; fall back to the phone
  // (only used when a new lead has to be created).
  const contactName: string = isIncoming ? (senderData.senderName ?? phone) : phone;

  let content = '';
  let msgType: 'text' | 'image' | 'document' = 'text';
  let mediaUrl: string | null = null;
  let fileName: string | null = null;

  if (messageData.typeMessage === 'textMessage') {
    content = messageData.textMessageData?.textMessage ?? '';
  } else if (messageData.typeMessage === 'imageMessage') {
    const fd = messageData.fileMessageData ?? {};
    content = fd.caption ?? '';
    mediaUrl = fd.downloadUrl ?? null;
    fileName = fd.fileName ?? null;
    msgType = 'image';
  } else if (messageData.typeMessage === 'documentMessage') {
    const fd = messageData.fileMessageData ?? {};
    content = fd.caption ?? '';
    mediaUrl = fd.downloadUrl ?? null;
    fileName = fd.fileName ?? null;
    msgType = 'document';
  } else if (messageData.typeMessage === 'extendedTextMessage') {
    content = messageData.extendedTextMessageData?.text ?? '';
  } else {
    return res.status(200).json({ received: true });
  }

  // Text needs content; media is valid even with an empty caption as long as we
  // have the file itself.
  if (!content && !mediaUrl) return res.status(200).json({ received: true });

  // Idempotency: Green API delivers at-least-once and retries on non-2xx, so drop a
  // message we've already stored (matched by its idMessage).
  const externalId: string | null = body?.idMessage ? String(body.idMessage) : null;
  if (externalId) {
    const dup = await prisma.message.findFirst({ where: { tenantId, externalId } });
    if (dup) return res.status(200).json({ received: true, duplicate: true });
  }

  // Upsert lead atomically — two messages from a brand-new number arriving together
  // would otherwise both miss on findFirst and collide on the (tenantId, phone) unique.
  const existingLead = await prisma.lead.findFirst({ where: { tenantId, phone } });

  // Round-robin: a brand-new inbound lead gets auto-assigned to the next agent (if the
  // tenant enabled it). Computed before create so the lead surfaces in that agent's list
  // immediately. Only for genuinely-inbound new conversations.
  const autoAssignee = (!existingLead && isIncoming) ? await pickRoundRobinAssignee(tenantId) : null;

  const lead = await prisma.lead.upsert({
    where: { tenantId_phone: { tenantId, phone } },
    // Stamp the line this conversation arrived on (backfill legacy leads that lack one).
    update: { lastMessageAt: new Date(), ...(lineId ? { lineId } : {}) },
    create: { tenantId, phone, name: contactName, lastMessageAt: new Date(), lineId, ...(autoAssignee ? { assignedTo: autoAssignee } : {}) },
  });

  if (!existingLead) {
    await logActivity(lead.id, tenantId, 'ליד נוצר', isIncoming ? 'נוצר מהודעת וואצאפ נכנסת' : 'נוצר מהודעת וואצאפ יוצאת (מהטלפון)');
    if (autoAssignee) await logActivity(lead.id, tenantId, 'שיוך נציג', `הוקצה אוטומטית ל-${autoAssignee}`);
  }

  const message = await prisma.message.create({
    data: {
      tenantId,
      leadId: lead.id,
      content,
      type: msgType,
      mediaUrl,
      fileName,
      externalId,
      direction: isIncoming ? 'inbound' : 'outbound',
      status: isIncoming ? 'delivered' : 'sent',
    },
  });

  const io: SocketIOServer = req.app.get('io');
  // Route to managers + the assigned agent only. A brand-new inbound lead has no
  // assignee yet → managers see it and can assign it.
  emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.NEW_MESSAGE, message);
  emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.LEAD_UPDATED, lead);
  if (!existingLead) emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.LEAD_CREATED, lead);

  console.log(`${isIncoming ? '📩' : '📤'} [${tenantName}] ${phone}: ${content.substring(0, 50)}`);

  // Post-ingest hooks (inbound only). Fire-and-forget so a slow/failed hook never
  // delays the webhook 200 (Green API retries on non-2xx).
  if (isIncoming) {
    // Precedence: list command > CSAT rating reply > normal auto-reply. Each of the
    // first two consumes the message so we don't also fire a greeting/off-hours reply.
    const optKind = classifyOptMessage(content);
    if (optKind) {
      void handleOptChange(tenantId, lead.id, optKind);
    } else {
      void tryCaptureCsatAnswer(tenantId, lead, content).then((captured) => {
        if (!captured) return handleInboundAutoReply({ tenantId, lead, isNewLead: !existingLead });
      });
    }
    // The 'lead.message_received' automation event was declared but never fired until now.
    void triggerAutomations('lead.message_received', { lead, message }, tenantId);
    // Push notification to the managers + assigned agent (mirrors emitScoped).
    void notifyLeadEvent(tenantId, lead.assignedTo, { title: lead.name, body: content, leadId: lead.id });
  }

  return res.status(200).json({ received: true });
}

// ─── POST /webhook/:instanceId ────────────────────────────────────────────────
webhookRouter.post('/:instanceId', async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where: { greenApiInstanceId: instanceId, active: true },
    });

    if (!tenant) {
      console.warn(`⚠️ Webhook for unknown instanceId: ${instanceId}`);
      return res.status(200).json({ received: true });
    }

    if (!webhookAuthorized(req, tenant.webhookSecret)) {
      console.warn(`⚠️ Webhook rejected (bad/missing token) for instanceId: ${instanceId}`);
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Which line owns this number? (once lines exist; falls back to null pre-migration)
    const line = await prisma.line.findFirst({ where: { tenantId: tenant.id, greenApiInstanceId: instanceId } });
    return processWebhook(req, res, tenant.id, tenant.name, line?.id ?? null);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /webhook (no instanceId in URL) ────────────────────────────────────
// Backwards compat for webhook URLs without the /:instanceId suffix.
// Green API includes the receiving instance in `body.instanceData.idInstance`,
// so we resolve the tenant from the payload. We NEVER guess "the first tenant"
// when more than one tenant is configured — that would mis-attribute messages
// across tenants.
webhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const bodyInstanceId: string | undefined = req.body?.instanceData?.idInstance
      ? String(req.body.instanceData.idInstance)
      : undefined;

    if (bodyInstanceId) {
      const tenant = await prisma.tenant.findFirst({
        where: { greenApiInstanceId: bodyInstanceId, active: true },
      });
      if (!tenant) {
        console.warn(`⚠️ Webhook for unknown instanceId (from body): ${bodyInstanceId}`);
        return res.status(200).json({ received: true });
      }
      if (!webhookAuthorized(req, tenant.webhookSecret)) {
        console.warn(`⚠️ Webhook rejected (bad/missing token) for instanceId: ${bodyInstanceId}`);
        return res.status(401).json({ error: 'unauthorized' });
      }
      const line = await prisma.line.findFirst({ where: { tenantId: tenant.id, greenApiInstanceId: bodyInstanceId } });
      return processWebhook(req, res, tenant.id, tenant.name, line?.id ?? null);
    }

    // No instance info in the payload — only safe to route in a single-tenant deployment.
    const configured = await prisma.tenant.findMany({
      where: { active: true, greenApiInstanceId: { not: null } },
      take: 2,
    });

    if (configured.length === 0) {
      console.warn('⚠️ Webhook received but no tenant has Green API configured');
      return res.status(200).json({ received: true });
    }
    if (configured.length > 1) {
      console.warn('⚠️ Webhook without instanceId but multiple tenants configured — cannot attribute safely. Configure the /:instanceId webhook URL per tenant.');
      return res.status(200).json({ received: true });
    }

    if (!webhookAuthorized(req, configured[0].webhookSecret)) {
      console.warn('⚠️ Webhook rejected (bad/missing token) on single-tenant fallback');
      return res.status(401).json({ error: 'unauthorized' });
    }

    return processWebhook(req, res, configured[0].id, configured[0].name);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
