// CSAT surveys: when a lead is closed, ask for a 1–5 rating a short while later,
// then capture the reply. Deliberately one question — response rates collapse with
// anything longer, and the score feeds the dashboard per agent.

import { prisma } from './prisma';
import { sendOutboundText } from './outbound';
import { enqueueJob, registerJobHandler, type ClaimedJob } from './jobs';
import { entitlementsFor } from './entitlements';
import { logActivity } from './activity';

// How long after asking we still accept a bare digit as the answer.
const ANSWER_WINDOW_MS = 72 * 60 * 60 * 1000;
const DEFAULT_ASK = 'תודה שבחרת בנו! נשמח אם תדרג/י את השירות שקיבלת מ-1 (לא מרוצה) עד 5 (מרוצה מאוד) 🙏';
const DEFAULT_THANKS = 'תודה רבה על המשוב! 🙏';

interface CsatConfig { enabled?: boolean; askText?: string; delayMin?: number }

function parseCsat(json: unknown): CsatConfig | null {
  if (!json || typeof json !== 'object') return null;
  const c = json as { csat?: CsatConfig };
  return c.csat ?? null;
}

/** Queue a CSAT survey when a lead moves to CLOSED. Best-effort, never throws. */
export async function scheduleCsatSurvey(tenantId: string, leadId: string): Promise<void> {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { autoReplies: true, plan: true } });
    if (!tenant || !entitlementsFor(tenant.plan).features.csat) return;
    const cfg = parseCsat(tenant.autoReplies);
    if (!cfg?.enabled) return;

    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId }, select: { optedOut: true, csatAskedAt: true } });
    if (!lead || lead.optedOut) return;
    // Don't re-survey a lead that was already asked recently (e.g. reopened + closed again).
    if (lead.csatAskedAt && Date.now() - lead.csatAskedAt.getTime() < ANSWER_WINDOW_MS) return;

    const delayMin = Math.min(Math.max(cfg.delayMin ?? 60, 1), 10080);
    await enqueueJob(tenantId, 'csat_ask', new Date(Date.now() + delayMin * 60_000), { leadId });
  } catch (err) {
    console.warn('scheduleCsatSurvey failed:', (err as Error).message);
  }
}

// Send the survey question and stamp csatAskedAt (which opens the answer window).
registerJobHandler('csat_ask', async (payload: unknown, job: ClaimedJob) => {
  const { leadId } = (payload ?? {}) as { leadId?: string };
  if (!leadId) return;

  const tenant = await prisma.tenant.findUnique({ where: { id: job.tenantId }, select: { autoReplies: true, plan: true } });
  if (!tenant || !entitlementsFor(tenant.plan).features.csat) return;
  const cfg = parseCsat(tenant.autoReplies);
  if (!cfg?.enabled) return;

  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId: job.tenantId }, select: { optedOut: true, status: true } });
  if (!lead || lead.optedOut) return;
  if (lead.status !== 'CLOSED') return; // reopened before the survey fired → skip

  const r = await sendOutboundText(job.tenantId, leadId, cfg.askText?.trim() || DEFAULT_ASK, {});
  if (!r.ok) throw new Error(r.error || 'csat ask failed'); // let the runner retry
  await prisma.lead.update({ where: { id: leadId }, data: { csatAskedAt: new Date() } });
});

/**
 * Try to read an inbound message as a CSAT answer. Returns true when it was consumed
 * as a rating (so the caller skips the normal auto-reply).
 */
export async function tryCaptureCsatAnswer(
  tenantId: string,
  lead: { id: string; csatAskedAt: Date | null; csatScore: number | null },
  content: string,
): Promise<boolean> {
  try {
    if (!lead.csatAskedAt) return false;
    if (Date.now() - lead.csatAskedAt.getTime() > ANSWER_WINDOW_MS) return false;
    if (lead.csatScore != null) return false; // already answered

    const m = content.trim().match(/^([1-5])$/); // a bare 1–5 only
    if (!m) return false;
    const score = Number(m[1]);

    await prisma.lead.update({ where: { id: lead.id }, data: { csatScore: score } });
    await logActivity(lead.id, tenantId, 'דירוג שירות', `הלקוח דירג ${score}/5`);
    await sendOutboundText(tenantId, lead.id, DEFAULT_THANKS, { enforceDailyCap: false });
    return true;
  } catch (err) {
    console.warn('tryCaptureCsatAnswer failed:', (err as Error).message);
    return false;
  }
}
