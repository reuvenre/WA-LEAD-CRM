import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { isGoogleConfigured, buildAuthUrl, verifyState, exchangeCode, getGoogleEmail } from '../lib/google';

export const googleRouter = Router();

// GET /api/google/status — is the server configured + is this user connected?
googleRouter.get('/status', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  return res.json({
    configured: isGoogleConfigured(),
    connected: Boolean(user?.googleRefreshToken),
    email: user?.googleEmail ?? null,
  });
});

// GET /api/google/auth-url — start the OAuth consent flow
googleRouter.get('/auth-url', requireAuth, (req: Request, res: Response) => {
  if (!isGoogleConfigured()) {
    return res.status(400).json({ error: 'חיבור Google אינו מוגדר בשרת (חסר GOOGLE_CLIENT_ID/SECRET)' });
  }
  return res.json({ url: buildAuthUrl(req.user!.userId) });
});

// GET /api/google/callback — Google redirects here (public; trust comes from signed state)
googleRouter.get('/callback', async (req: Request, res: Response) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:3002';
  const code = req.query.code ? String(req.query.code) : '';
  const userId = verifyState(req.query.state ? String(req.query.state) : '');

  if (!code || !userId) return res.redirect(`${frontend}/?google=error`);

  try {
    const tokens = await exchangeCode(code);
    const email = await getGoogleEmail(tokens.access_token);
    await prisma.user.update({
      where: { id: userId },
      data: {
        // refresh_token is only returned on consent; keep the old one if absent
        ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
        ...(email ? { googleEmail: email } : {}),
      },
    });
    return res.redirect(`${frontend}/?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.redirect(`${frontend}/?google=error`);
  }
});

// POST /api/google/disconnect — forget the user's Google connection
googleRouter.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { googleRefreshToken: null, googleEmail: null },
  });
  return res.json({ success: true });
});
