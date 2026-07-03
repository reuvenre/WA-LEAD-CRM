import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS, emitScoped } from '../socket';
import { canAccessLead } from '../middleware/auth';
import { getProvider, resolveCreds } from '../lib/messaging';
import { Server as SocketIOServer } from 'socket.io';

export const messagesRouter = Router();

// Load the tenant's legacy Green API creds (fallback for leads without a line yet).
async function tenantCreds(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { greenApiInstanceId: true, greenApiToken: true },
  });
}

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

    // Include the line so we send from the number this conversation belongs to.
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId }, include: { line: true } });
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });

    // Providers need a digits-only number (chatId = <phone>@c.us). Reject invalid
    // phones here so the user gets a clear message instead of an opaque provider error.
    const phone = (lead.phone ?? '').replace(/\D/g, '');
    if (!phone) {
      return res.status(400).json({ error: 'לליד אין מספר טלפון תקין — לא ניתן לשלוח הודעה' });
    }

    const creds = resolveCreds(lead.line, await tenantCreds(tenantId));
    const result = await getProvider(creds.provider).sendText(creds, phone, content);

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
// and posts JSON; the provider uploads the raw bytes and returns a hosted URL we
// store so the message renders in the chat.
messagesRouter.post('/send-file', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { leadId, fileBase64, fileName, mimeType, caption = '' } = req.body as {
      leadId?: string; fileBase64?: string; fileName?: string; mimeType?: string; caption?: string;
    };

    if (!leadId || !fileBase64 || !fileName) {
      return res.status(400).json({ error: 'leadId, fileBase64 and fileName are required' });
    }

    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId }, include: { line: true } });
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

    const creds = resolveCreds(lead.line, await tenantCreds(tenantId));
    const result = await getProvider(creds.provider).sendFile(
      creds, phone, buffer, fileName, mimeType ?? 'application/octet-stream', caption,
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
