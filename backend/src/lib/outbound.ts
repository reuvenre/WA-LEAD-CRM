// Context-free outbound text sender — the one path every AUTOMATED sender uses
// (auto-replies, scheduled messages, CSAT surveys, broadcast campaigns).
//
// Unlike routes/messages.ts (which lives inside an Express request), this takes plain
// ids so it can run from a job handler. It still funnels through the same provider
// abstraction + daily anti-ban cap, and can be paced per-line for bulk sends.

import { prisma } from './prisma';
import { getProvider, resolveCreds } from './messaging';
import { tryBumpDailyCap, trialStatusOf } from './entitlements';
import { paced, lineKeyFor } from './sendQueue';
import { SOCKET_EVENTS, emitScoped, getIo } from '../socket';

export interface SendOutboundOpts {
  paced?: boolean;          // route through the per-line 3–8s pacer (bulk/automated)
  markAutoReply?: boolean;  // stamp lead.lastAutoReplyAt (auto-reply anti-loop)
  enforceDailyCap?: boolean; // default true
  emit?: boolean;           // emit realtime message:new (default true)
}

export interface SendOutboundResult {
  ok: boolean;
  messageId?: string;   // our Message row id
  externalId?: string;  // provider message id
  error?: string;
}

/**
 * Send `content` to a lead and record it as an outbound message. Resolves the
 * conversation's line (falling back to tenant creds), enforces the daily cap, and
 * emits a scoped realtime event. WEBCHAT leads have no external provider — the
 * message is persisted and the visitor receives it via polling.
 */
export async function sendOutboundText(
  tenantId: string,
  leadId: string,
  content: string,
  opts: SendOutboundOpts = {},
): Promise<SendOutboundResult> {
  const enforceDailyCap = opts.enforceDailyCap ?? true;
  const emit = opts.emit ?? true;

  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId }, include: { line: true } });
  if (!lead) return { ok: false, error: 'lead not found' };

  // Automated sends (auto-reply, scheduled, campaign, CSAT) must also stop once the
  // trial expires OR the account is cancelled — otherwise a job queued earlier would
  // keep messaging. This path only ever sends (no read methods involved).
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, trialEndsAt: true, canceledAt: true } });
  if (t?.canceledAt) return { ok: false, error: 'המנוי בוטל — המערכת במצב קריאה בלבד' };
  if (t && trialStatusOf(t).expired) return { ok: false, error: 'תקופת הניסיון הסתיימה — שדרג כדי להמשיך לשלוח' };

  const doSend = async (): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    // WEBCHAT: no external gateway — the widget polls; skip provider + cap.
    if (lead.channel === 'WEBCHAT') return { success: true };

    const phone = (lead.phone ?? '').replace(/\D/g, '');
    if (!phone) return { success: false, error: 'לליד אין מספר טלפון תקין' };

    if (enforceDailyCap) {
      const { ok, cap } = await tryBumpDailyCap(tenantId, lead.line);
      if (!ok) return { success: false, error: `הגעת למגבלת ההודעות היומית (${cap})` };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { greenApiInstanceId: true, greenApiToken: true },
    });
    const creds = resolveCreds(lead.line, tenant);
    return getProvider(creds.provider).sendText(creds, phone, content);
  };

  const result = opts.paced ? await paced(lineKeyFor(lead), doSend) : await doSend();
  if (!result.success) return { ok: false, error: result.error || 'שליחה נכשלה' };

  // From here the message HAS left via the provider. Bookkeeping failures must not
  // throw — a caller (job runner) that retries on throw would send the customer the
  // same message again. Log + report ok instead.
  try {
    const message = await prisma.message.create({
      data: {
        tenantId, leadId, content, type: 'text',
        direction: 'outbound', status: 'sent',
        externalId: result.messageId ?? null,
      },
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastMessageAt: new Date(), ...(opts.markAutoReply ? { lastAutoReplyAt: new Date() } : {}) },
    });

    if (emit) {
      const io = getIo();
      if (io) emitScoped(io, tenantId, lead.assignedTo, SOCKET_EVENTS.NEW_MESSAGE, message);
    }

    return { ok: true, messageId: message.id, externalId: result.messageId };
  } catch (err) {
    console.error(`⚠️ outbound bookkeeping failed AFTER provider send (lead ${leadId}) — message went out but wasn't recorded:`, (err as Error).message);
    return { ok: true, externalId: result.messageId };
  }
}
