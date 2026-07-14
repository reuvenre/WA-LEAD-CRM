// Auto-replies: greeting (first contact), off-hours notice, and away message
// (delayed "we'll get back to you" when no human replies in time).
//
// Called from the inbound pipeline (webhook.ts today; widget.ts in wave 2). At most
// one auto message per lead per throttle window, so a chatty visitor never gets
// spammed and two auto-replies never ping-pong.

import { prisma } from './prisma';
import { sendOutboundText } from './outbound';
import { enqueueJob, registerJobHandler, type ClaimedJob } from './jobs';
import { entitlementsFor } from './entitlements';

export interface AutoReplyConfig {
  greeting?: { enabled: boolean; text: string };
  offHours?: { enabled: boolean; text: string; days: number[]; from: string; to: string; tz?: string };
  away?: { enabled: boolean; text: string; delayMin: number };
}

const THROTTLE_MS = 6 * 60 * 60 * 1000; // ≤ 1 auto-reply per lead per 6h
const DEFAULT_TZ = 'Asia/Jerusalem';

function parseConfig(json: unknown): AutoReplyConfig | null {
  if (!json || typeof json !== 'object') return null;
  return json as AutoReplyConfig;
}

// Is `now` outside the configured business hours (in the config's timezone)?
// days = business days as 0(Sun)–6(Sat); outside `from`..`to` or a non-business day = off-hours.
export function isOffHours(cfg: NonNullable<AutoReplyConfig['offHours']>, now: Date = new Date()): boolean {
  const tz = cfg.tz || DEFAULT_TZ;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[get('weekday')];
  let hh = parseInt(get('hour'), 10);
  if (hh === 24) hh = 0; // some environments render midnight as "24"
  const minutes = hh * 60 + parseInt(get('minute'), 10);

  if (!Array.isArray(cfg.days) || !cfg.days.includes(day)) return true;
  const [fromH, fromM] = (cfg.from || '09:00').split(':').map(Number);
  const [toH, toM] = (cfg.to || '18:00').split(':').map(Number);
  return minutes < fromH * 60 + fromM || minutes >= toH * 60 + toM;
}

function throttled(lastAutoReplyAt: Date | null | undefined): boolean {
  return !!lastAutoReplyAt && Date.now() - new Date(lastAutoReplyAt).getTime() < THROTTLE_MS;
}

/**
 * Decide + send an auto-reply for an inbound message. Best-effort: never throws
 * (callers fire-and-forget so a config typo can't drop the inbound message).
 * Precedence: off-hours notice > greeting (new lead). If neither applies, an away
 * message is *scheduled* for later (cancelled implicitly if a human replies first).
 */
export async function handleInboundAutoReply(args: {
  tenantId: string;
  lead: { id: string; lastAutoReplyAt: Date | null; channel: string };
  isNewLead: boolean;
}): Promise<void> {
  try {
    const { tenantId, lead, isNewLead } = args;
    if (throttled(lead.lastAutoReplyAt)) return;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { autoReplies: true, plan: true } });
    if (!tenant || !entitlementsFor(tenant.plan).features.autoReplies) return;
    const cfg = parseConfig(tenant.autoReplies);
    if (!cfg) return;

    let text: string | null = null;
    if (cfg.offHours?.enabled && cfg.offHours.text && isOffHours(cfg.offHours)) {
      text = cfg.offHours.text;
    } else if (isNewLead && cfg.greeting?.enabled && cfg.greeting.text) {
      text = cfg.greeting.text;
    }

    if (text) {
      await sendOutboundText(tenantId, lead.id, text, { markAutoReply: true });
      return; // one auto message at a time — don't also queue an away reply
    }

    // No immediate reply — queue an away message that fires only if nobody responds.
    if (cfg.away?.enabled && cfg.away.text && cfg.away.delayMin > 0) {
      await enqueueJob(tenantId, 'away_reply', new Date(Date.now() + cfg.away.delayMin * 60_000), { leadId: lead.id });
    }
  } catch (err) {
    console.warn('auto-reply failed:', (err as Error).message);
  }
}

// Delayed away-message: send only if no outbound has happened on the lead since the
// inbound that scheduled this (i.e. no agent/auto reply meanwhile), and not throttled.
registerJobHandler('away_reply', async (payload: unknown, job: ClaimedJob) => {
  const { leadId } = (payload ?? {}) as { leadId?: string };
  if (!leadId) return;

  const tenant = await prisma.tenant.findUnique({ where: { id: job.tenantId }, select: { autoReplies: true, plan: true } });
  if (!tenant || !entitlementsFor(tenant.plan).features.autoReplies) return;
  const cfg = parseConfig(tenant.autoReplies);
  if (!cfg?.away?.enabled || !cfg.away.text) return;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId: job.tenantId },
    select: { id: true, lastAutoReplyAt: true },
  });
  if (!lead || throttled(lead.lastAutoReplyAt)) return;

  // If the most recent message is outbound, someone already responded → stay quiet.
  const last = await prisma.message.findFirst({
    where: { leadId, tenantId: job.tenantId },
    orderBy: { timestamp: 'desc' },
    select: { direction: true },
  });
  if (last?.direction === 'outbound') return;

  await sendOutboundText(job.tenantId, leadId, cfg.away.text, { markAutoReply: true });
});
