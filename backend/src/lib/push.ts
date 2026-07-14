// Web Push fan-out. Notifies the SAME recipients as a scoped socket emit — the
// tenant's managers plus the lead's assigned agent — when a new inbound message
// arrives and the app may be closed/backgrounded.
//
// Degrades gracefully: with no VAPID keys configured, pushEnabled() is false and
// everything is a no-op (the server still boots and realtime still works).

import webpush from 'web-push';
import { prisma } from './prisma';

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@wa-lead-crm.app';

let enabled = false;
if (PUBLIC && PRIVATE) {
  try { webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE); enabled = true; }
  catch (e) { console.warn('⚠️ Web Push: invalid VAPID keys —', (e as Error).message); }
} else {
  console.warn('⚠️ Web Push disabled — set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to enable.');
}

export function pushEnabled(): boolean { return enabled; }
export function vapidPublicKey(): string | null { return PUBLIC ?? null; }

export interface PushPayload { title: string; body: string; leadId?: string }

export async function notifyLeadEvent(
  tenantId: string,
  assignedTo: string | null | undefined,
  payload: PushPayload,
): Promise<void> {
  if (!enabled) return;
  try {
    // Recipients: managers (whole tenant) + the assigned agent — mirrors emitScoped.
    const users = await prisma.user.findMany({
      where: {
        tenantId, active: true,
        OR: [
          { role: { in: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'] } },
          ...(assignedTo ? [{ username: assignedTo }] : []),
        ],
      },
      select: { id: true },
    });
    if (users.length === 0) return;

    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: users.map((u) => u.id) } } });
    if (subs.length === 0) return;

    const body = JSON.stringify({ title: payload.title, body: payload.body.slice(0, 160), leadId: payload.leadId ?? null });
    await Promise.allSettled(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      } catch (err) {
        // 404/410 = the subscription is gone (uninstalled / permission revoked) — prune it.
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }));
  } catch (e) {
    console.warn('notifyLeadEvent failed:', (e as Error).message);
  }
}
