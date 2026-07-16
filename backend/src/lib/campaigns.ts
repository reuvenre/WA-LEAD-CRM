// Broadcast campaign engine. A campaign fans a message out to a filtered audience,
// one recipient per job tick, paced by the job runner + a small re-enqueue delay so
// bulk sends never burst (anti-ban). Honors opt-out and the per-line daily cap
// (pausing until the next day when the cap is hit, then resuming automatically).

import { prisma } from './prisma';
import { registerJobHandler, enqueueJob, setJobPayload, cancelPendingJobs, type ClaimedJob } from './jobs';
import { sendOutboundText } from './outbound';
import { tryBumpDailyCap } from './entitlements';
import { paced, lineKeyFor } from './sendQueue';
import { Prisma } from '@prisma/client';

export interface DripStep { afterHours: number; body: string }

// Drip steps for many recipients would otherwise all come due at the same instant and
// burst. Spread each recipient's step over a window so sends trickle out.
const JITTER_MS = () => Math.floor(Math.random() * 10 * 60_000); // 0–10 min

export function parseSteps(json: unknown): DripStep[] {
  if (!Array.isArray(json)) return [];
  return (json as DripStep[])
    .filter((s) => s && typeof s.body === 'string' && s.body.trim())
    .map((s) => ({ afterHours: Math.max(0, Number(s.afterHours) || 0), body: s.body }));
}

export interface CampaignFilter {
  status?: string;         // a LeadStatus, or 'all'/undefined for any
  tags?: string[];
  projectId?: string;
  channel?: string;        // defaults to WHATSAPP (the broadcast-able channel)
}

// Prisma `where` for a campaign audience: matches the filter and excludes opted-out
// leads. WhatsApp targets must have a phone; other channels (WEBCHAT) deliver without
// one — requiring a phone there made every non-WhatsApp audience silently empty.
export function audienceWhere(tenantId: string, filter: CampaignFilter | null | undefined) {
  const f = filter ?? {};
  const channel = (f.channel as Prisma.EnumLeadChannelFilter['equals']) ?? 'WHATSAPP';
  const where: Prisma.LeadWhereInput = {
    tenantId,
    optedOut: false,
    channel,
    ...(channel === 'WHATSAPP' ? { phone: { not: null } } : {}),
  };
  if (f.status && f.status !== 'all') where.status = f.status as Prisma.EnumLeadStatusFilter['equals'];
  if (f.tags && f.tags.length) where.tags = { hasSome: f.tags };
  if (f.projectId) where.projectId = f.projectId;
  return where;
}

// Server-side template substitution (the per-recipient values differ, so unlike the
// interactive composer this must run at send time). Function replacers avoid $-pattern
// injection from lead data.
export function renderCampaignText(body: string, lead: { name: string; phone: string | null; attributes: unknown }): string {
  const attrs = (lead.attributes && typeof lead.attributes === 'object' ? lead.attributes : {}) as Record<string, unknown>;
  return body
    .replace(/\{\{שם\}\}/g, () => lead.name)
    .replace(/\{\{name\}\}/g, () => lead.name)
    .replace(/\{\{טלפון\}\}/g, () => lead.phone ?? '')
    .replace(/\{\{phone\}\}/g, () => lead.phone ?? '')
    .replace(/\{\{attr:([a-zA-Z0-9_]+)\}\}/g, (_m, k: string) => { const v = attrs[k]; return v == null ? '' : String(v); });
}

const GAP_MS = () => 4000 + Math.floor(Math.random() * 5000); // 4–9s between recipients

function reenqueue(tenantId: string, campaignId: string, at: Date) {
  return enqueueJob(tenantId, 'campaign_send', at, { campaignId });
}

// The daily cap resets when the UTC date rolls over (entitlements counts by UTC date),
// so cap-paused work resumes shortly after UTC midnight — NOT server-local midnight,
// which is only the same thing while the container happens to run with TZ=UTC.
function nextUtcMidnight(): Date {
  const next = new Date();
  next.setUTCHours(24, 5, 0, 0);
  return next;
}

// Atomically claim ONE pending recipient (pending → sending). The claim is what makes
// a duplicated send chain, or a job retry after a mid-send crash, unable to pick the
// same recipient twice. Returns null when no pending recipient could be claimed.
async function claimNextRecipient(campaignId: string): Promise<{ id: string; leadId: string } | null> {
  // Stale 'sending' rows (claimed, then the process died before resolving) are
  // resolved as sent-unconfirmed rather than re-sent: for marketing bulk the safe
  // failure mode is at-most-once — never spam a customer twice.
  await prisma.campaignRecipient.updateMany({
    where: { campaignId, status: 'sending', updatedAt: { lt: new Date(Date.now() - 8 * 60_000) } },
    data: { status: 'sent', error: 'נשלח ללא אישור (שחזור לאחר קריסה)' },
  });

  for (let i = 0; i < 5; i++) {
    const rec = await prisma.campaignRecipient.findFirst({
      where: { campaignId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, leadId: true },
    });
    if (!rec) return null;
    const claimed = await prisma.campaignRecipient.updateMany({
      where: { id: rec.id, status: 'pending' },
      data: { status: 'sending' },
    });
    if (claimed.count === 1) return rec; // someone else grabbed it → next candidate
  }
  return null;
}

// Materialize the audience into CampaignRecipient rows and kick off sending (or schedule).
export async function startCampaign(tenantId: string, campaignId: string): Promise<number> {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
  if (!campaign) throw new Error('campaign not found');

  const leads = await prisma.lead.findMany({
    where: audienceWhere(tenantId, campaign.filter as CampaignFilter | null),
    select: { id: true },
    take: 5000, // hard cap per campaign
  });
  if (leads.length > 0) {
    await prisma.campaignRecipient.createMany({
      data: leads.map((l) => ({ campaignId, leadId: l.id })),
      skipDuplicates: true,
    });
  }

  const scheduled = campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now();
  const startAt = scheduled ? campaign.scheduledAt! : new Date();
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: scheduled ? 'scheduled' : 'running' } });

  const steps = parseSteps(campaign.steps);
  if (steps.length > 0) {
    // Drip: each recipient walks its own step chain independently, jittered so the
    // cohort doesn't fire in lockstep.
    const recipients = await prisma.campaignRecipient.findMany({ where: { campaignId, status: 'pending' }, select: { leadId: true } });
    for (const r of recipients) {
      const at = new Date(startAt.getTime() + steps[0].afterHours * 3_600_000 + JITTER_MS());
      await enqueueJob(tenantId, 'drip_step', at, { campaignId, leadId: r.leadId, stepIndex: 0 });
    }
  } else {
    // Broadcast: a single chain that walks recipients one per tick.
    await reenqueue(tenantId, campaignId, startAt);
  }
  return leads.length;
}

// ─── Job handler: send ONE recipient per tick, then re-arm ────────────────────
registerJobHandler('campaign_send', async (payload: unknown, job: ClaimedJob) => {
  const { campaignId } = (payload ?? {}) as { campaignId?: string };
  if (!campaignId) return;

  // Collapse duplicate chains: a cap-paused job left queued through a pause/resume
  // cycle (or a double /send race) would otherwise walk the audience in parallel
  // with this chain — doubling the send rate and double-sending recipients.
  await cancelPendingJobs(job.tenantId, 'campaign_send', 'campaignId', campaignId);

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId: job.tenantId } });
  if (!campaign) return;                          // deleted → stop
  if (campaign.status === 'paused' || campaign.status === 'done') return; // stop
  if (parseSteps(campaign.steps).length > 0) return; // drip — never walked by the broadcast chain
  if (campaign.status === 'scheduled') {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'running' } });
  }

  const rec = await claimNextRecipient(campaignId);
  if (!rec) { // audience drained
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'done' } });
    return;
  }

  const lead = await prisma.lead.findFirst({ where: { id: rec.leadId, tenantId: job.tenantId }, include: { line: true } });

  // Skip cases advance to the next recipient immediately (no send).
  if (!lead) {
    await prisma.campaignRecipient.update({ where: { id: rec.id }, data: { status: 'skipped', error: 'lead deleted' } });
    await reenqueue(job.tenantId, campaignId, new Date());
    return;
  }
  if (lead.optedOut) {
    await prisma.campaignRecipient.update({ where: { id: rec.id }, data: { status: 'skipped', error: 'opted out' } });
    await reenqueue(job.tenantId, campaignId, new Date());
    return;
  }

  // Daily anti-ban cap: if hit, release the claim and pause until just after UTC
  // midnight (when the cap resets) — the campaign resumes automatically tomorrow.
  const cap = await tryBumpDailyCap(job.tenantId, lead.line);
  if (!cap.ok) {
    await prisma.campaignRecipient.updateMany({ where: { id: rec.id, status: 'sending' }, data: { status: 'pending' } });
    await reenqueue(job.tenantId, campaignId, nextUtcMidnight());
    return;
  }

  // Cap already consumed above → don't double-count. sendOutboundText never throws
  // once the provider accepted the message, so a job retry can't re-send.
  const text = renderCampaignText(campaign.body, lead);
  const result = await sendOutboundText(job.tenantId, rec.leadId, text, { enforceDailyCap: false });
  await prisma.campaignRecipient.update({
    where: { id: rec.id },
    data: result.ok
      ? { status: 'sent', messageId: result.externalId ?? null, error: null }
      : { status: 'failed', error: (result.error ?? 'send failed').slice(0, 300) },
  });

  await reenqueue(job.tenantId, campaignId, new Date(Date.now() + GAP_MS()));
});

// ─── Job handler: one drip step for one recipient, then schedule the next ─────
// Each recipient has its own chain. The sequence stops early if the lead replies
// (the whole point of a drip) or opts out.
registerJobHandler('drip_step', async (payload: unknown, job: ClaimedJob) => {
  const p = (payload ?? {}) as { campaignId?: string; leadId?: string; stepIndex?: number; sent?: boolean };
  const { campaignId, leadId, stepIndex } = p;
  if (!campaignId || !leadId || typeof stepIndex !== 'number') return;

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId: job.tenantId } });
  if (!campaign || campaign.status === 'done') return;
  // Paused → SNOOZE, don't die. Killing the chain here made pause permanent: after
  // resume nothing ever rescheduled the per-recipient jobs, so every sequence that
  // came due during the pause was silently lost.
  if (campaign.status === 'paused') {
    await enqueueJob(job.tenantId, 'drip_step', new Date(Date.now() + 15 * 60_000), { campaignId, leadId, stepIndex });
    return;
  }
  if (campaign.status === 'scheduled') {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'running' } });
  }

  const steps = parseSteps(campaign.steps);
  const step = steps[stepIndex];
  if (!step) return; // sequence finished

  const rec = await prisma.campaignRecipient.findFirst({ where: { campaignId, leadId } });
  if (!rec) return;

  // finishStep runs the post-send bookkeeping + next-step scheduling; shared with the
  // crash-retry path below so a retried job still advances the sequence.
  const finishStep = async (data: { status: string; messageId?: string | null; error?: string | null }) => {
    await prisma.campaignRecipient.update({ where: { id: rec.id }, data });
    const next = steps[stepIndex + 1];
    if (next) {
      const at = new Date(Date.now() + next.afterHours * 3_600_000 + JITTER_MS());
      await enqueueJob(job.tenantId, 'drip_step', at, { campaignId, leadId, stepIndex: stepIndex + 1 });
    } else {
      // Last step for this recipient — if no other recipient still has a queued step,
      // the whole drip is finished (a drip never went 'done' before, so the UI showed
      // it as active forever and pause/send stayed enabled on a finished campaign).
      const remaining = await prisma.job.count({
        where: { tenantId: job.tenantId, type: 'drip_step', status: { in: ['pending', 'running'] }, payload: { path: ['campaignId'], equals: campaignId } },
      });
      if (remaining <= 1) { // ourselves — we're still 'running'
        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'done' } });
      }
    }
  };

  // Crash-retry idempotency: the payload is stamped { sent: true } right before the
  // provider call. A retry that sees the stamp must NOT send again — it only finishes
  // the bookkeeping the crash interrupted.
  if (p.sent) {
    await finishStep({ status: 'sent', error: 'נשלח ללא אישור (שחזור לאחר קריסה)' });
    return;
  }

  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId: job.tenantId }, include: { line: true } });
  if (!lead) {
    await prisma.campaignRecipient.update({ where: { id: rec.id }, data: { status: 'skipped', error: 'lead deleted' } });
    return;
  }
  if (lead.optedOut) {
    await prisma.campaignRecipient.update({ where: { id: rec.id }, data: { status: 'skipped', error: 'opted out' } });
    return;
  }

  // The lead answered since enrolling → they're engaged; stop the sequence.
  const replied = await prisma.message.findFirst({
    where: { leadId, tenantId: job.tenantId, direction: 'inbound', timestamp: { gt: rec.createdAt } },
    select: { id: true },
  });
  if (replied) {
    await prisma.campaignRecipient.update({ where: { id: rec.id }, data: { status: 'skipped', error: 'הלקוח הגיב — הרצף הופסק' } });
    return;
  }

  // Daily cap → retry this step just after UTC midnight (when the cap resets)
  // rather than dropping it.
  const cap = await tryBumpDailyCap(job.tenantId, lead.line);
  if (!cap.ok) {
    await enqueueJob(job.tenantId, 'drip_step', nextUtcMidnight(), { campaignId, leadId, stepIndex });
    return;
  }

  // Pace per line: several recipients' steps can come due together, so serialize.
  await setJobPayload(job.id, { campaignId, leadId, stepIndex, sent: true });
  const text = renderCampaignText(step.body, lead);
  const result = await paced(lineKeyFor(lead), () => sendOutboundText(job.tenantId, leadId, text, { enforceDailyCap: false }));
  await finishStep(
    result.ok
      ? { status: 'sent', messageId: result.externalId ?? null, error: null }
      : { status: 'failed', error: (result.error ?? 'send failed').slice(0, 300) },
  );
});
