// Web Push subscription management (per authenticated user).
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { pushEnabled, vapidPublicKey } from '../lib/push';

export const pushRouter = Router();

// The public VAPID key the browser needs to subscribe (+ whether push is configured).
pushRouter.get('/public-key', (_req: Request, res: Response) => {
  return res.json({ key: vapidPublicKey(), enabled: pushEnabled() });
});

// Register (or refresh) this browser's push subscription for the current user.
pushRouter.post('/subscribe', async (req: Request, res: Response) => {
  const { subscription, userAgent } = req.body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; userAgent?: string;
  };
  const ep = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!ep || !p256dh || !auth) return res.status(400).json({ error: 'מנוי דחיפה לא תקין' });

  if (!/^https:\/\//.test(ep) || ep.length > 1000) return res.status(400).json({ error: 'מנוי דחיפה לא תקין' });

  // Endpoint is globally unique; re-binding it to the current user is the legitimate
  // shared-device flow (a different agent logs in on the same browser — the browser
  // proves possession by presenting its own endpoint). Cross-TENANT rebinds are never
  // legitimate though, so a subscription owned by another tenant's user is replaced
  // only after deleting it (never silently moved between organizations).
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: ep },
    select: { user: { select: { tenantId: true } } },
  });
  if (existing && existing.user.tenantId !== req.user!.tenantId) {
    await prisma.pushSubscription.delete({ where: { endpoint: ep } }).catch(() => {});
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint: ep },
    update: { userId: req.user!.userId, p256dh, auth, userAgent: userAgent?.slice(0, 300) ?? null },
    create: { userId: req.user!.userId, endpoint: ep, p256dh, auth, userAgent: userAgent?.slice(0, 300) ?? null },
  });
  return res.json({ success: true });
});

pushRouter.post('/unsubscribe', async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.userId } });
  return res.json({ success: true });
});
