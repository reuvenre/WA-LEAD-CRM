import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS } from '../socket';
import { Server as SocketIOServer } from 'socket.io';

export const webhookRouter = Router();

// ─── POST: Green API Webhook ──────────────────────────────────────────────────
// Green API sends JSON directly — no signature validation needed
webhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Green API webhook structure
    const typeWebhook = body?.typeWebhook;

    // Only handle incoming messages
    if (typeWebhook !== 'incomingMessageReceived') {
      return res.status(200).json({ received: true });
    }

    const messageData = body?.messageData;
    const senderData = body?.senderData;

    if (!messageData || !senderData) {
      return res.status(200).json({ received: true });
    }

    // Extract phone — Green API format: "972501234567@c.us"
    const chatId: string = senderData.chatId ?? '';
    const phone = chatId.replace('@c.us', '').replace('@g.us', '');

    if (!phone || chatId.includes('@g.us')) {
      // Skip group messages
      return res.status(200).json({ received: true });
    }

    const senderName: string = senderData.senderName ?? phone;

    // Extract message content
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
      // Unsupported message type
      return res.status(200).json({ received: true });
    }

    if (!content) return res.status(200).json({ received: true });

    // Upsert lead
    const lead = await prisma.lead.upsert({
      where: { phone },
      update: { lastMessageAt: new Date() },
      create: {
        phone,
        name: senderName,
        lastMessageAt: new Date(),
      },
    });

    // Save message
    const message = await prisma.message.create({
      data: {
        leadId: lead.id,
        content,
        type: msgType,
        direction: 'inbound',
        status: 'delivered',
      },
      include: { lead: true },
    });

    // Emit real-time events
    const io: SocketIOServer = req.app.get('io');
    io.emit(SOCKET_EVENTS.NEW_MESSAGE, message);
    io.to(`lead:${lead.id}`).emit(SOCKET_EVENTS.NEW_MESSAGE, message);
    io.emit(SOCKET_EVENTS.LEAD_UPDATED, lead);

    console.log(`📩 Green API message from ${senderName} (${phone}): ${content.substring(0, 50)}`);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
