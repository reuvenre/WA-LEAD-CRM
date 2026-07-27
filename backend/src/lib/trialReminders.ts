// Trial lifecycle nudges.
//
// The in-app trial banner only reaches someone who already opened the app — so the
// customers most likely to lapse are exactly the ones it never reaches. These emails
// go to the account owner's inbox instead, and the last one carries a time-boxed
// discount so an expiring trial has somewhere to go other than silence.
//
//   soon      — 4 days left  ("here's what you'd lose")
//   last_day  — 1 day left
//   expired   — the trial ended; grants the win-back discount
//
// Two things trigger them: precise jobs enqueued at signup, and a periodic sweep that
// backfills anything missing — tenants who registered before this shipped, jobs lost
// to a failed deploy, or a server that was down when one came due. Both paths are
// idempotent: a stage is CLAIMED atomically in Tenant.trialNudges before the mail is
// handed to SMTP, so no customer can receive the same nudge twice.

import { prisma } from './prisma';
import { registerJobHandler, enqueueJob, cancelPendingJobs } from './jobs';
import { sendMail, isMailConfigured } from './mailer';
import { frontendUrl, PLAN_PRICES } from './billing';

export type NudgeStage = 'soon' | 'last_day' | 'expired';

const DAY_MS = 86_400_000;
/** How much trial must be left for each pre-expiry stage to be due. */
const DUE_WITHIN_MS: Record<NudgeStage, number> = {
  soon: 4 * DAY_MS,
  last_day: 1 * DAY_MS,
  expired: 0,
};

// Win-back terms. Deliberately generous but short: the offer has to be worth
// interrupting someone who already decided to walk away.
export const WINBACK_PERCENT = 40;
export const WINBACK_DAYS = 7;

// How stale an expiry may be and still be worth an email. Without this, the first
// sweep after a long outage — or after restoring an old backup — would mail a
// discount to every trial that lapsed months ago, all at once.
const EXPIRED_MAX_AGE_MS = 14 * 86_400_000;

const SWEEP_INTERVAL_MS = 6 * 3_600_000; // 6h — the sweep is a safety net, not the clock
const SWEEP_FIRST_RUN_MS = 30_000;       // let the server finish booting first

// ─── Scheduling ──────────────────────────────────────────────────────────────
/** Queue the three nudges for a fresh trial. Safe to re-run; replaces any pending set. */
export async function scheduleTrialNudges(tenantId: string, trialEndsAt: Date): Promise<void> {
  await cancelPendingJobs(tenantId, 'trial_nudge', 'tenantId', tenantId);
  const now = Date.now();
  for (const stage of ['soon', 'last_day', 'expired'] as NudgeStage[]) {
    const runAt = new Date(trialEndsAt.getTime() - DUE_WITHIN_MS[stage]);
    // A trial shorter than the lead time (or a backdated one) skips the stages that
    // already passed — the sweep decides whether those are still worth sending.
    if (runAt.getTime() > now) await enqueueJob(tenantId, 'trial_nudge', runAt, { tenantId, stage });
  }
}

/** Drop queued nudges — the customer upgraded or is closing the account. */
export async function cancelTrialNudges(tenantId: string): Promise<void> {
  await cancelPendingJobs(tenantId, 'trial_nudge', 'tenantId', tenantId);
}

// ─── Sending ─────────────────────────────────────────────────────────────────
export async function sendTrialNudge(tenantId: string, stage: NudgeStage): Promise<boolean> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, email: true, plan: true, trialEndsAt: true, canceledAt: true },
  });
  if (!t || !t.trialEndsAt) return false;
  // Upgraded, or on the way out — either way there is nothing to nudge about, and
  // selling to someone who just cancelled reads as tone-deaf.
  if (t.plan !== 'TRIAL' || t.canceledAt) return false;

  // Don't fire early. Guards a sweep that races the precise job, and a precise job
  // that survived a trial being extended after it was queued.
  const msLeft = t.trialEndsAt.getTime() - Date.now();
  if (msLeft > DUE_WITHIN_MS[stage]) return false;
  // ...and don't fire absurdly late either: a months-old lapse gets silence, not a
  // discount email that reads as if we only just noticed.
  if (-msLeft > EXPIRED_MAX_AGE_MS) return false;

  // Claim the stage atomically. Whoever wins the UPDATE sends; everyone else backs
  // off. Claiming BEFORE the send means a crashed SMTP call costs one missed email
  // rather than risking a duplicate on retry — the wrong way round is worse.
  const claimed = await prisma.tenant.updateMany({
    where: { id: tenantId, NOT: { trialNudges: { has: stage } } },
    data: { trialNudges: { push: stage } },
  });
  if (claimed.count === 0) return false;

  if (stage === 'expired') {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { winbackPercent: WINBACK_PERCENT, winbackUntil: new Date(Date.now() + WINBACK_DAYS * DAY_MS) },
    });
  }

  if (!isMailConfigured() || !t.email) return true;
  const { subject, html } = renderNudge(stage, t.name, t.trialEndsAt);
  await sendMail(t.email, subject, html).catch((e) =>
    // Already claimed, so this will not be retried. Loud on purpose: a silent drop
    // here is lost revenue nobody would ever notice.
    console.error(`[trial] ${stage} email to tenant ${tenantId} failed:`, (e as Error).message),
  );
  return true;
}

// ─── Email bodies ────────────────────────────────────────────────────────────
const BRAND = 'Real Estate Lead CRM';

function shell(inner: string): string {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px">${inner}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">${BRAND} — מבית WIN SOLUTIONS</p>
  </div>`;
}

function cta(label: string): string {
  return `<p style="margin:24px 0"><a href="${frontendUrl()}/" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;display:inline-block;font-weight:bold">${label}</a></p>`;
}

function renderNudge(stage: NudgeStage, name: string, endsAt: Date): { subject: string; html: string } {
  const when = endsAt.toLocaleDateString('he-IL');
  const basic = PLAN_PRICES.BASIC.monthly / 100;

  if (stage === 'soon') {
    return {
      subject: `נשארו 4 ימים לתקופת הניסיון — ${BRAND}`,
      html: shell(`
        <h2 style="color:#4f46e5">נשארו 4 ימים</h2>
        <p>שלום,</p>
        <p>תקופת הניסיון של <b>${name}</b> מסתיימת ב-<b>${when}</b>.</p>
        <p>בסיום, החשבון עובר ל<b>קריאה בלבד</b>: הלידים וההיסטוריה נשארים, אבל לא ניתן יהיה לשלוח הודעות, לענות אוטומטית או לקלוט לידים חדשים.</p>
        <p>שדרוג לוקח פחות מדקה ומתחיל ב-${basic}₪ לחודש.</p>
        ${cta('שדרג עכשיו')}`),
    };
  }

  if (stage === 'last_day') {
    return {
      subject: `מחר תקופת הניסיון מסתיימת — ${BRAND}`,
      html: shell(`
        <h2 style="color:#d97706">נשאר יום אחד</h2>
        <p>תקופת הניסיון של <b>${name}</b> מסתיימת <b>מחר</b> (${when}).</p>
        <p>אם לא תשדרג עד אז, המענה האוטומטי יפסיק לפעול ולידים חדשים שייכנסו לא יקבלו תשובה. הנתונים שלך נשמרים במלואם.</p>
        ${cta('השאר את המערכת פעילה')}`),
    };
  }

  return {
    subject: `תקופת הניסיון הסתיימה — ${WINBACK_PERCENT}% הנחה לחודש הראשון`,
    html: shell(`
      <h2 style="color:#4f46e5">תקופת הניסיון הסתיימה</h2>
      <p>החשבון של <b>${name}</b> עבר למצב <b>קריאה בלבד</b>. כל הלידים, השיחות וההגדרות שמורים — שדרוג מחזיר הכל לפעולה מיידית.</p>
      <p style="background:#eef2ff;border-radius:10px;padding:16px">
        <b style="font-size:18px;color:#4f46e5">${WINBACK_PERCENT}% הנחה על התשלום הראשון</b><br />
        ההנחה נכנסת אוטומטית במסך השדרוג ותקפה ${WINBACK_DAYS} ימים.
      </p>
      ${cta('הפעל מחדש עם ההנחה')}
      <p style="color:#64748b;font-size:13px">לא מתאים לך כרגע? אפשר לייצא את כל הנתונים בכל עת מתוך הגדרות ← חשבון.</p>`),
  };
}

// ─── Job + sweep ─────────────────────────────────────────────────────────────
registerJobHandler('trial_nudge', async (payload: unknown) => {
  const { tenantId, stage } = (payload ?? {}) as { tenantId?: string; stage?: NudgeStage };
  if (!tenantId || !stage) return;
  await sendTrialNudge(tenantId, stage);
});

/**
 * Catch anything the precise jobs missed. Reads only trials that are already inside
 * the earliest nudge window, and relies on the atomic claim for correctness — so
 * running it alongside the per-tenant jobs is safe by construction.
 */
export async function sweepTrials(): Promise<number> {
  const now = Date.now();
  const candidates = await prisma.tenant.findMany({
    where: {
      plan: 'TRIAL',
      canceledAt: null,
      trialEndsAt: { not: null, lte: new Date(now + DUE_WITHIN_MS.soon) },
    },
    select: { id: true, trialEndsAt: true, trialNudges: true },
  });

  let sent = 0;
  for (const t of candidates) {
    const msLeft = t.trialEndsAt!.getTime() - now;
    for (const stage of ['soon', 'last_day', 'expired'] as NudgeStage[]) {
      if (msLeft > DUE_WITHIN_MS[stage] || t.trialNudges.includes(stage)) continue;
      if (await sendTrialNudge(t.id, stage)) sent += 1;
    }
  }
  return sent;
}

// The sweep is process-level rather than a Job row, because Job requires a tenantId
// and this work belongs to no single tenant. Same single-instance assumption the job
// runner already documents.
let sweepTimer: NodeJS.Timeout | null = null;
let firstRun: NodeJS.Timeout | null = null;

function runSweep(): void {
  void sweepTrials()
    .then((n) => { if (n) console.log(`[trial] sweep sent ${n} nudge(s)`); })
    .catch((e) => console.error('[trial] sweep failed:', (e as Error).message));
}

export function startTrialSweep(): void {
  if (sweepTimer) return;
  firstRun = setTimeout(runSweep, SWEEP_FIRST_RUN_MS);
  sweepTimer = setInterval(runSweep, SWEEP_INTERVAL_MS);
}

export function stopTrialSweep(): void {
  if (firstRun) { clearTimeout(firstRun); firstRun = null; }
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
}
