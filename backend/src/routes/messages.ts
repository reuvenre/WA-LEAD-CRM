import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS, emitScoped } from '../socket';
import { canAccessLead } from '../middleware/auth';
import { Server as SocketIOServer } from 'socket.io';

export const messagesRouter = Router();

// ─── GET /messages/:leadId ───────────────────────────────────────────────────
messagesRouter.get('/:leadId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    // Only expose a conversation the caller may see (their own lead, or any if manager).
    const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId, tenantId } });
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });
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
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });

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
        externalId: result.messageId ?? null,
      },
    });

    await prisma.lead.update({ where: { id: leadId }, data: { lastMessageAt: new Date() } });

    const io: SocketIOServer = req.app.get('io');
    emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.NEW_MESSAGE, message);

    return res.json({ message, result });
  } catch (error) {
    console.error('POST /messages/send error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /messages/send-file ────────────────────────────────────────────────
// Sends an image or document over WhatsApp. The frontend base64-encodes the file
// and posts JSON; we forward the raw bytes to Green API's sendFileByUpload, then
// store the returned hosted URL so the message renders in the chat.
messagesRouter.post('/send-file', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { leadId, fileBase64, fileName, mimeType, caption = '' } = req.body as {
      leadId?: string; fileBase64?: string; fileName?: string; mimeType?: string; caption?: string;
    };

    if (!leadId || !fileBase64 || !fileName) {
      return res.status(400).json({ error: 'leadId, fileBase64 and fileName are required' });
    }

    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });

    const phone = (lead.phone ?? '').replace(/\D/g, '');
    if (!phone) {
      return res.status(400).json({ error: 'לליד אין מספר טלפון תקין — לא ניתן לשלוח קובץ' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length === 0) return res.status(400).json({ error: 'הקובץ ריק או פגום' });
    if (buffer.length > 16 * 1024 * 1024) {
      return res.status(413).json({ error: 'הקובץ גדול מדי (מקסימום 16MB)' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const result = await sendGreenAPIFile(
      phone, buffer, fileName, mimeType ?? 'application/octet-stream', caption,
      tenant?.greenApiInstanceId, tenant?.greenApiToken,
    );

    if (!result.success) {
      return res.status(502).json({ error: result.error || 'שליחת הקובץ נכשלה' });
    }

    const isImage = (mimeType ?? '').startsWith('image/');
    const message = await prisma.message.create({
      data: {
        tenantId,
        leadId,
        content: caption ?? '',
        type: isImage ? 'image' : 'document',
        mediaUrl: result.urlFile ?? null,
        fileName,
        direction: 'outbound',
        status: 'sent',
        externalId: result.messageId ?? null,
      },
    });

    await prisma.lead.update({ where: { id: leadId }, data: { lastMessageAt: new Date() } });

    const io: SocketIOServer = req.app.get('io');
    emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.NEW_MESSAGE, message);

    return res.json({ message, result });
  } catch (error) {
    console.error('POST /messages/send-file error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Green API integration ────────────────────────────────────────────────────
// Media methods live on media.green-api.com (not api.green-api.com). Uploads the
// raw file via multipart/form-data; the response carries the hosted urlFile.
async function sendGreenAPIFile(
  phone: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
  caption: string,
  idInstance?: string | null,
  apiToken?: string | null,
): Promise<{ success: boolean; messageId?: string; urlFile?: string; error?: string }> {
  if (!idInstance || !apiToken) {
    console.log(`[MOCK] Sending file ${fileName} (${file.length} bytes) to ${phone}`);
    return { success: true, messageId: `mock_${Date.now()}`, urlFile: '' };
  }

  try {
    const chatId = `${phone}@c.us`;
    const endpoint = `https://media.green-api.com/waInstance${idInstance}/sendFileByUpload/${apiToken}`;

    const form = new FormData();
    form.append('chatId', chatId);
    form.append('file', new Blob([file], { type: mimeType }), fileName);
    form.append('fileName', fileName);
    if (caption) form.append('caption', caption);

    const response = await fetch(endpoint, { method: 'POST', body: form });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as { message?: string };
      return { success: false, error: errBody.message ?? `Green API HTTP ${response.status}` };
    }

    const data = await response.json() as { idMessage?: string; urlFile?: string };
    console.log(`✅ Green API uploaded ${fileName} to ${phone}: ${data.idMessage}`);
    return { success: true, messageId: data.idMessage, urlFile: data.urlFile };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

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
