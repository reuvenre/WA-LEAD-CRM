import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS } from '../socket';
import { Server as SocketIOServer } from 'socket.io';

export const messagesRouter = Router();

// ─── GET /messages/:leadId ───────────────────────────────────────────────────
messagesRouter.get('/:leadId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const messages = await prisma.message.findMany({
      where: { leadId: req.params.leadId, tenantId },
      orderBy: { timestamp: 'asc' },
    });
    return res.json(messages);
  } catch (error) {
    console.error('GET /messages/:leadId error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /messages/send ─────────────────────────────────────────────────────
messagesRouter.post('/send', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { leadId, content, type = 'text' } = req.body;

    if (!leadId || !content) return res.status(400).json({ error: 'leadId and content are required' });

    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Green API requires a digits-only number (chatId = <phone>@c.us). Reject leads
    // without a valid phone here so the user gets a clear message instead of an opaque
    // Green API validation error.
    const phone = (lead.phone ?? '').replace(/\D/g, '');
    if (!phone) {
      return res.status(400).json({ error: 'לליד אין מספר טלפון תקין — לא ניתן לשלוח הודעה' });
    }

    // Get tenant's Green API credentials
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const result = await sendGreenAPIMessage(phone, content, type, tenant?.greenApiInstanceId, tenant?.greenApiToken);

    // Don't record a failed send as a delivered message — surface the failure so the UI can retry.
    if (!result.success) {
      return res.status(502).json({ error: result.error || 'שליחת ההודעה נכשלה' });
    }

    const message = await prisma.message.create({
      data: {
        tenantId,
        leadId,
        content,
        type: type === 'image' ? 'image' : 'text',
        direction: 'outbound',
        status: 'sent',
      },
    });

    await prisma.lead.update({ where: { id: leadId }, data: { lastMessageAt: new Date() } });

    const io: SocketIOServer = req.app.get('io');
    io.to(tenantId).emit(SOCKET_EVENTS.NEW_MESSAGE, message);

    return res.json({ message, result });
  } catch (error) {
    console.error('POST /messages/send error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Green API integration ────────────────────────────────────────────────────
async function sendGreenAPIMessage(
  phone: string,
  content: string,
  type: string,
  idInstance?: string | null,
  apiToken?: string | null,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!idInstance || !apiToken) {
    console.log(`[MOCK] Sending to ${phone}: ${content.substring(0, 50)}`);
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  try {
    const chatId = `${phone}@c.us`;
    const baseUrl = `https://api.green-api.com/waInstance${idInstance}`;

    let endpoint = '';
    let payload: Record<string, unknown> = {};

    if (type === 'image') {
      endpoint = `${baseUrl}/sendFileByUrl/${apiToken}`;
      payload = { chatId, urlFile: content, fileName: 'image.jpg', caption: '' };
    } else {
      endpoint = `${baseUrl}/sendMessage/${apiToken}`;
      payload = { chatId, message: content };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json() as { message?: string };
      return { success: false, error: errBody.message ?? 'Unknown error' };
    }

    const data = await response.json() as { idMessage?: string };
    console.log(`✅ Green API sent to ${phone}: ${data.idMessage}`);
    return { success: true, messageId: data.idMessage };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
