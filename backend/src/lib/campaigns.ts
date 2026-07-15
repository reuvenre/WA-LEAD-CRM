// Broadcast campaign engine. A campaign fans a message out to a filtered audience,
// one recipient per job tick, paced by the job runner + a small re-enqueue delay so
// bulk sends never burst (anti-ban). Honors opt-out and the per-line daily cap
// (pausing until the next day when the cap is hit, then resuming automatically).

import { prisma } from './prisma';
import { registerJobHandler, enqueueJob, type ClaimedJob } from './jobs';
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

// Prisma `where` for a campaign audience: matches the filter, excludes opted-out
// leads, and requires a phone (only reachable WhatsApp leads are broadcast targets).
export function audienceWhere(tenantId: string, filter: CampaignFilter | null | undefined) {
  const f = filter ?? {};
  const where: Prisma.LeadWhereInput = {
    tenantId,
    optedOut: false,
    phone: { not: null },
    channel: (f.channel as Prisma.EnumLeadChannelFilter['equals']) ?? 'WHATSAPP',
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

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId: job.tenantId } });
  if (!campaign) return;                          // deleted → stop
  if (campaign.status === 'paused' || campaign.status === 'done') return; // stop
  if (campaign.status === 'scheduled') {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'running' } });
  }

  const rec = await prisma.campaignRecipient.findFirst({
    where: { campaignId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  if (!rec) { // audience drained
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'done' } });
    return;
  }

  const lead = await prisma.lead.findFirst({ where: { id: rec.leadId, tenantId: job.tenantId }, include: { line: true } });

  // Skip cases advance to the next recipient immediately (no send).
  if (!lead) {
    await prisma.campaignRecipient.update({ where: { id: rec.id }, data: { status: 'skipped', error: 'lead deleted' } });
    return void reenqueue(job.tenantId, campaignId, new Date());
  }
  if (lead.optedOut) {
    await prisma.campaignRecipient.update({ where: { id: rec.id }, data: { status: 'skipped', error: 'opted out' } });
    return void reenqueue(job.tenantId, campaignId, new Date());
  }

  // Daily anti-ban cap: if hit, pause until just after midnight (cap resets by date)
  // and leave this recipient pending — the campaign resumes automatically tomorrow.
  const cap = await tryBumpDailyCap(job.tenantId, lead.line);
  if (!cap.ok) {
    const next = new Date(); next.setHours(24, 5, 0, 0);
    return void reenqueue(job.tenantId, campaignId, next);
  }

  // Cap already consumed above → don't double-count.
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
  const { campaignId, leadId, stepIndex } = (payload ?? {}) as { campaignId?: string; leadId?: string; stepIndex?: number };
  if (!campaignId || !leadId || typeof stepIndex !== 'number') return;

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId: job.tenantId } });
  if (!campaign || campaign.status === 'paused' || campaign.status === 'done') return;

  const steps = parseSteps(campaign.steps);
  const step = steps[stepIndex];
  if (!step) return; // sequence finished

  const rec = await prisma.campaignRecipient.findFirst({ where: { campaignId, leadId } });
  if (!rec) return;

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

  // Daily cap → retry this step after midnight rather than dropping it.
  const cap = await tryBumpDailyCap(job.tenantId, lead.line);
  if (!cap.ok) {
    const next = new Date(); next.setHours(24, 5, 0, 0);
    await enqueueJob(job.tenantId, 'drip_step', next, { campaignId, leadId, stepIndex });
    return;
  }

  // Pace per line: several recipients' steps can come due together, so serialize.
  const text = renderCampaignText(step.body, lead);
  const result = await paced(lineKeyFor(lead), () => sendOutboundText(job.tenantId, leadId, text, { enforceDailyCap: false }));
  await prisma.campaignRecipient.update({
    where: { id: rec.id },
    data: result.ok
      ? { status: 'sent', messageId: result.externalId ?? null, error: null }
      : { status: 'failed', error: (result.error ?? 'send failed').slice(0, 300) },
  });

  // Queue the next step for this recipient.
  const next = steps[stepIndex + 1];
  if (next) {
    const at = new Date(Date.now() + next.afterHours * 3_600_000 + JITTER_MS());
    await enqueueJob(job.tenantId, 'drip_step', at, { campaignId, leadId, stepIndex: stepIndex + 1 });
  }
});
