// Broadcast campaign engine. A campaign fans a message out to a filtered audience,
// one recipient per job tick, paced by the job runner + a small re-enqueue delay so
// bulk sends never burst (anti-ban). Honors opt-out and the per-line daily cap
// (pausing until the next day when the cap is hit, then resuming automatically).

import { prisma } from './prisma';
import { registerJobHandler, enqueueJob, type ClaimedJob } from './jobs';
import { sendOutboundText } from './outbound';
import { tryBumpDailyCap } from './entitlements';
import { Prisma } from '@prisma/client';

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
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: scheduled ? 'scheduled' : 'running' } });
  await reenqueue(tenantId, campaignId, scheduled ? campaign.scheduledAt! : new Date());
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
