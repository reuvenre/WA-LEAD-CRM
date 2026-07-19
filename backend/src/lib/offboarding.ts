// Account offboarding: cancel → 30-day read-only grace → scheduled purge.
//
// Flow: the customer cancels (routes/tenant.ts) → canceledAt=now, purgeAt=now+30d,
// account goes read-only (requireWritableAccount). Two jobs are enqueued: a warning
// email 3 days before purge, and the purge itself at purgeAt. Reactivating clears the
// dates and cancels both jobs (win-back). At purgeAt the tenant + ALL its data are
// hard-deleted (cascade).

import { prisma } from './prisma';
import { registerJobHandler, enqueueJob, cancelPendingJobs, type ClaimedJob } from './jobs';
import { CANCEL_GRACE_DAYS } from './entitlements';
import { sendMail, isMailConfigured } from './mailer';

const WARN_DAYS_BEFORE = 3;

// ── Cancel ────────────────────────────────────────────────────────────────────
export async function cancelTenant(tenantId: string): Promise<{ canceledAt: Date; purgeAt: Date }> {
  const canceledAt = new Date();
  const purgeAt = new Date(canceledAt.getTime() + CANCEL_GRACE_DAYS * 86_400_000);
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { canceledAt, purgeAt },
    select: { name: true, email: true },
  });

  // Clear any leftover jobs from a previous cancel, then schedule warning + purge.
  await cancelPendingJobs(tenantId, 'tenant_purge', 'tenantId', tenantId);
  await cancelPendingJobs(tenantId, 'tenant_purge_warning', 'tenantId', tenantId);
  const warnAt = new Date(purgeAt.getTime() - WARN_DAYS_BEFORE * 86_400_000);
  if (warnAt > new Date()) await enqueueJob(tenantId, 'tenant_purge_warning', warnAt, { tenantId });
  await enqueueJob(tenantId, 'tenant_purge', purgeAt, { tenantId });

  // Confirmation email (best-effort — never block the cancel on SMTP).
  if (isMailConfigured() && tenant.email) {
    const when = purgeAt.toLocaleDateString('he-IL');
    void sendMail(
      tenant.email,
      'ביטול המנוי — Real Estate Lead CRM',
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px">
        <h2 style="color:#4f46e5">המנוי בוטל</h2>
        <p>שלום,</p>
        <p>קיבלנו את בקשתך לבטל את המנוי של <b>${tenant.name}</b>. החשבון עבר למצב <b>קריאה בלבד</b>.</p>
        <p>הנתונים שלך יישמרו עד <b>${when}</b> (${CANCEL_GRACE_DAYS} יום), וניתן להוריד אותם בכל עת מתוך מסך ההגדרות. לאחר מועד זה כל הנתונים יימחקו לצמיתות.</p>
        <p>התחרטת? אפשר להפעיל את החשבון מחדש בכל רגע במהלך התקופה, מתוך הגדרות ← חשבון.</p>
      </div>`,
    ).catch((e) => console.warn('cancel email failed:', (e as Error).message));
  }
  return { canceledAt, purgeAt };
}

// ── Reactivate (win-back during the grace window) ─────────────────────────────
export async function reactivateTenant(tenantId: string): Promise<void> {
  await prisma.tenant.update({ where: { id: tenantId }, data: { canceledAt: null, purgeAt: null } });
  await cancelPendingJobs(tenantId, 'tenant_purge', 'tenantId', tenantId);
  await cancelPendingJobs(tenantId, 'tenant_purge_warning', 'tenantId', tenantId);
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
// Warn 3 days before deletion.
registerJobHandler('tenant_purge_warning', async (payload: unknown, job: ClaimedJob) => {
  const { tenantId } = (payload ?? {}) as { tenantId?: string };
  if (!tenantId) return;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, email: true, canceledAt: true, purgeAt: true } });
  if (!t || !t.canceledAt || !t.purgeAt) return; // reactivated in the meantime → skip
  if (!isMailConfigured() || !t.email) return;
  const when = t.purgeAt.toLocaleDateString('he-IL');
  await sendMail(
    t.email,
    'תזכורת: הנתונים שלך יימחקו בקרוב — Real Estate Lead CRM',
    `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px">
      <h2 style="color:#dc2626">תזכורת לפני מחיקת נתונים</h2>
      <p>הנתונים של <b>${t.name}</b> יימחקו לצמיתות ב-<b>${when}</b>.</p>
      <p>אם ברצונך לשמור אותם — הורד אותם עכשיו מהגדרות ← חשבון, או הפעל את החשבון מחדש כדי לבטל את המחיקה.</p>
    </div>`,
  ).catch((e) => console.warn('purge-warning email failed:', (e as Error).message));
});

// Purge: hard-delete the tenant and ALL its data (cascade). Guarded against a
// race with reactivation — only deletes if still cancelled and past purgeAt.
registerJobHandler('tenant_purge', async (payload: unknown, job: ClaimedJob) => {
  const { tenantId } = (payload ?? {}) as { tenantId?: string };
  if (!tenantId) return;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { canceledAt: true, purgeAt: true, name: true } });
  if (!t || !t.canceledAt || !t.purgeAt) return;      // reactivated → don't delete
  if (t.purgeAt.getTime() > Date.now()) {              // rescheduled later → re-arm
    await enqueueJob(tenantId, 'tenant_purge', t.purgeAt, { tenantId });
    return;
  }
  // Cascade deletes leads, messages, projects, templates, campaigns, users, jobs, etc.
  // (The job row itself is cascade-deleted mid-run; the runner's done-update no-ops.)
  console.log(`🗑️  Purging cancelled tenant "${t.name}" (${tenantId}) after grace period`);
  await prisma.tenant.delete({ where: { id: tenantId } });
});
