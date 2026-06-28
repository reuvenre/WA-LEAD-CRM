import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS } from '../socket';
import { Server as SocketIOServer } from 'socket.io';
import { logActivity } from '../lib/activity';

export const webhookRouter = Router();

// ─── Shared processing logic ──────────────────────────────────────────────────
async function processWebhook(req: Request, res: Response, tenantId: string, tenantName: string) {
  const body = req.body;
  const typeWebhook = body?.typeWebhook;

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
  let msgType: 'text' | 'image' = 'text';

  if (messageData.typeMessage === 'textMessage') {
    content = messageData.textMessageData?.textMessage ?? '';
  } else if (messageData.typeMessage === 'imageMessage') {
    content = messageData.fileMessageData?.caption ?? '[תמונה]';
    msgType = 'image';
  } else if (messageData.typeMessage === 'extendedTextMessage') {
    content = messageData.extendedTextMessageData?.text ?? '';
  } else {
    return res.status(200).json({ received: true });
  }

  if (!content) return res.status(200).json({ received: true });

  // Upsert lead — scoped to this tenant
  const existingLead = await prisma.lead.findFirst({ where: { tenantId, phone } });

  const lead = existingLead
    ? await prisma.lead.update({ where: { id: existingLead.id }, data: { lastMessageAt: new Date() } })
    : await prisma.lead.create({
        data: { tenantId, phone, name: contactName, lastMessageAt: new Date() },
      });

  if (!existingLead) {
    await logActivity(lead.id, tenantId, 'ליד נוצר', isIncoming ? 'נוצר מהודעת וואצאפ נכנסת' : 'נוצר מהודעת וואצאפ יוצאת (מהטלפון)');
  }

  const message = await prisma.message.create({
    data: {
      tenantId,
      leadId: lead.id,
      content,
      type: msgType,
      direction: isIncoming ? 'inbound' : 'outbound',
      status: isIncoming ? 'delivered' : 'sent',
    },
  });

  const io: SocketIOServer = req.app.get('io');
  io.to(tenantId).emit(SOCKET_EVENTS.NEW_MESSAGE, message);
  io.to(tenantId).emit(SOCKET_EVENTS.LEAD_UPDATED, lead);
  if (!existingLead) io.to(tenantId).emit(SOCKET_EVENTS.LEAD_CREATED, lead);

  console.log(`${isIncoming ? '📩' : '📤'} [${tenantName}] ${phone}: ${content.substring(0, 50)}`);

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

    return processWebhook(req, res, tenant.id, tenant.name);
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
      return processWebhook(req, res, tenant.id, tenant.name);
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

    return processWebhook(req, res, configured[0].id, configured[0].name);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
