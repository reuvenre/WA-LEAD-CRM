import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { SOCKET_EVENTS, emitScoped } from '../socket';
import { canAccessLead } from '../middleware/auth';
import { getProvider, resolveCreds } from '../lib/messaging';
import { checkAndBumpDailyCap, featuresFor } from '../lib/entitlements';
import { enqueueJob } from '../lib/jobs';
import { Server as SocketIOServer } from 'socket.io';
import '../lib/scheduledMessages'; // registers the 'send_message' job handler

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

    // Anti-ban daily cap per line (also enforces the plan's daily message allowance).
    if (!(await checkAndBumpDailyCap(req, res, lead.line))) return;

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

    if (!(await checkAndBumpDailyCap(req, res, lead.line))) return;

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

// ─── POST /messages/schedule ─────────────────────────────────────────────────
// Queue a text to be sent at `sendAt` (send-later). Enforces the same access check
// as an immediate send; the daily cap is checked at send time by the job handler.
messagesRouter.post('/schedule', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    if (!(await featuresFor(tenantId)).scheduledMessages) {
      return res.status(403).json({ error: 'תזמון הודעות אינו כלול במסלול הנוכחי — נדרש שדרוג', upgrade: true });
    }
    const { leadId, content, sendAt } = req.body as { leadId?: string; content?: string; sendAt?: string };
    if (!leadId || !content?.trim() || !sendAt) {
      return res.status(400).json({ error: 'נדרשים ליד, תוכן וזמן שליחה' });
    }
    const when = new Date(sendAt);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() + 30_000) {
      return res.status(400).json({ error: 'זמן השליחה חייב להיות לפחות דקה בעתיד' });
    }

    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });

    const jobId = await enqueueJob(tenantId, 'send_message', when, { leadId, content: content.trim() });
    return res.status(201).json({ id: jobId, runAt: when.toISOString(), content: content.trim() });
  } catch (error) {
    console.error('POST /messages/schedule error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /messages/scheduled/:leadId ─────────────────────────────────────────
// Pending scheduled messages for a lead (so the UI can show + cancel them).
messagesRouter.get('/scheduled/:leadId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId, tenantId } });
    if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'Lead not found' });

    const jobs = await prisma.job.findMany({
      where: {
        tenantId, type: 'send_message', status: 'pending',
        payload: { path: ['leadId'], equals: req.params.leadId },
      },
      orderBy: { runAt: 'asc' },
      select: { id: true, runAt: true, payload: true },
    });
    return res.json(jobs.map((j) => ({
      id: j.id,
      runAt: j.runAt.toISOString(),
      content: (j.payload as { content?: string } | null)?.content ?? '',
    })));
  } catch (error) {
    console.error('GET /messages/scheduled/:leadId error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /messages/scheduled/:jobId ───────────────────────────────────────
// Cancel a pending scheduled message (only if the caller may access its lead).
messagesRouter.delete('/scheduled/:jobId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const job = await prisma.job.findFirst({
      where: { id: req.params.jobId, tenantId, type: 'send_message', status: 'pending' },
      select: { id: true, payload: true },
    });
    if (!job) return res.status(404).json({ error: 'הודעה מתוזמנת לא נמצאה' });

    const leadId = (job.payload as { leadId?: string } | null)?.leadId;
    if (leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
      if (!lead || !canAccessLead(req, lead.assignedTo)) return res.status(404).json({ error: 'הודעה מתוזמנת לא נמצאה' });
    }
    await prisma.job.update({ where: { id: job.id }, data: { status: 'cancelled' } });
    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /messages/scheduled/:jobId error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
