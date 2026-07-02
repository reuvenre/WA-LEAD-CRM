import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthPayload } from '../middleware/auth';
import { sendMail } from '../lib/mailer';
import { JWT_SECRET } from '../lib/config';

export const authRouter = Router();
const prisma = new PrismaClient();

const PASSWORD_REGEX = {
  minLength: (p: string) => p.length >= 12,
  uppercase: (p: string) => /[A-Z]/.test(p),
  special: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
};

export function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (!PASSWORD_REGEX.minLength(password)) errors.push('הסיסמה חייבת להכיל לפחות 12 תווים');
  if (!PASSWORD_REGEX.uppercase(password)) errors.push('הסיסמה חייבת להכיל אות גדולה');
  if (!PASSWORD_REGEX.special(password)) errors.push('הסיסמה חייבת להכיל תו מיוחד');
  return errors;
}

function signToken(payload: Omit<AuthPayload, 'step'>, expiresIn = '8h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as object);
}

// ─── In-memory brute-force limiter ────────────────────────────────────────────
// Keyed by identity (username/email/token), NOT IP — so it's correct behind
// Railway's proxy without trust-proxy tuning, and can't lock out a whole office
// sharing one egress IP. Single-instance deploy → in-memory is sufficient.
const attemptLog = new Map<string, number[]>();
function tooManyAttempts(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (attemptLog.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) { attemptLog.set(key, hits); return true; }
  hits.push(now);
  attemptLog.set(key, hits);
  return false;
}
function clearAttempts(key: string) { attemptLog.delete(key); }
// Opportunistic cleanup so the map can't grow unbounded over a long uptime.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attemptLog) {
    const fresh = v.filter((t) => now - t < 60 * 60 * 1000);
    if (fresh.length) attemptLog.set(k, fresh); else attemptLog.delete(k);
  }
}, 30 * 60 * 1000).unref();

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Create a new tenant + admin user
authRouter.post('/register', async (req: Request, res: Response) => {
  const { companyName, email, username, password } = req.body;

  if (!companyName?.trim()) return res.status(400).json({ error: 'נדרש שם חברה' });
  if (!email?.trim()) return res.status(400).json({ error: 'נדרשת כתובת אימייל' });
  if (!username?.trim()) return res.status(400).json({ error: 'נדרש שם משתמש' });

  const pwErrors = validatePassword(password ?? '');
  if (pwErrors.length) return res.status(400).json({ error: pwErrors.join(', ') });

  // Check email uniqueness
  const existing = await prisma.tenant.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'כתובת האימייל כבר רשומה במערכת' });

  const passwordHash = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.create({
    data: {
      name: companyName.trim(),
      email: email.trim().toLowerCase(),
      plan: 'TRIAL',
      users: {
        create: {
          username: username.trim(),
          passwordHash,
          role: 'ADMIN',
        },
      },
    },
    include: { users: true },
  });

  const user = tenant.users[0];
  const token = signToken({ userId: user.id, tenantId: tenant.id, tenantName: tenant.name, username: user.username, role: user.role as AuthPayload['role'] });

  return res.status(201).json({ token, tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan } });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, password, companyEmail } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'נדרשים שם משתמש וסיסמה' });

  const rlKey = `login:${String(companyEmail ?? '').trim().toLowerCase()}:${String(username).trim().toLowerCase()}`;
  if (tooManyAttempts(rlKey, 8, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד מספר דקות.' });
  }

  // Usernames are only unique within a tenant (@@unique([tenantId, username])), so a bare
  // username can match multiple tenants. Scope by company email when provided; otherwise
  // only proceed when the username is globally unambiguous, and ask for the company email
  // when it is not (never silently pick an arbitrary tenant).
  let user;
  if (companyEmail?.trim()) {
    const tenant = await prisma.tenant.findUnique({ where: { email: companyEmail.trim().toLowerCase() } });
    user = tenant
      ? await prisma.user.findFirst({
          where: { username: username.trim(), active: true, tenantId: tenant.id },
          include: { tenant: true },
        })
      : null;
  } else {
    const matches = await prisma.user.findMany({
      where: { username: username.trim(), active: true },
      include: { tenant: true },
      take: 2,
    });
    if (matches.length > 1) {
      return res.status(409).json({
        requiresCompany: true,
        error: 'קיימים מספר חשבונות עם שם משתמש זה — נא להזין את אימייל החברה',
      });
    }
    user = matches[0] ?? null;
  }

  if (!user) return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  if (!user.tenant.active) return res.status(403).json({ error: 'החשבון אינו פעיל. צור קשר עם התמיכה.' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });

  clearAttempts(rlKey); // correct password — reset the counter

  // Check 2FA (per user)
  if (user.totpEnabled && user.totpSecret) {
    const tempToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, username: user.username, role: user.role, step: '2fa_pending' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return res.json({ requires2FA: true, tempToken });
  }

  const token = signToken({ userId: user.id, tenantId: user.tenantId, tenantName: user.tenant.name, username: user.username, role: user.role as AuthPayload['role'] });
  return res.json({ token, tenant: { id: user.tenantId, name: user.tenant.name } });
});

// ─── POST /api/auth/login/2fa ─────────────────────────────────────────────────
authRouter.post('/login/2fa', async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: 'חסרים פרטים' });

  let payload: AuthPayload;
  try {
    payload = jwt.verify(tempToken, JWT_SECRET) as AuthPayload;
  } catch {
    return res.status(401).json({ error: 'הטוקן פג תוקף — אנא התחבר מחדש' });
  }

  if (payload.step !== '2fa_pending') return res.status(400).json({ error: 'טוקן לא תקין' });

  // Throttle TOTP guessing per user (6-digit code is otherwise brute-forceable).
  const rlKey = `2fa:${payload.userId}`;
  if (tooManyAttempts(rlKey, 6, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'יותר מדי ניסיונות. נסה שוב בעוד מספר דקות.' });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, include: { tenant: true } });
  if (!user?.totpSecret) return res.status(400).json({ error: '2FA לא מוגדר' });
  // Re-check active status — the login password-branch does, but a temp token could
  // outlive a deactivation.
  if (!user.active || !user.tenant.active) return res.status(403).json({ error: 'החשבון אינו פעיל. צור קשר עם התמיכה.' });

  const valid = speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token: code, window: 1 });
  if (!valid) return res.status(401).json({ error: 'קוד שגוי — נסה שוב' });

  clearAttempts(rlKey);
  const token = signToken({ userId: user.id, tenantId: user.tenantId, tenantName: user.tenant.name, username: user.username, role: user.role as AuthPayload['role'] });
  return res.json({ token });
});

// ─── POST /api/auth/verify ────────────────────────────────────────────────────
authRouter.post('/verify', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.json({ valid: false });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (payload.step === '2fa_pending') return res.json({ valid: false });
    return res.json({ valid: true, userId: payload.userId, tenantId: payload.tenantId, role: payload.role });
  } catch {
    return res.json({ valid: false });
  }
});

// ─── GET /api/auth/needs-setup ────────────────────────────────────────────────
// Legacy: always false now (setup happens via /register)
authRouter.get('/needs-setup', (_req: Request, res: Response) => {
  return res.json({ needsSetup: false });
});

// ─── POST /api/auth/2fa/setup ─────────────────────────────────────────────────
authRouter.post('/2fa/setup', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  const secret = speakeasy.generateSecret({ name: `WhatsApp CRM (${user.tenant.name}: ${user.username})`, length: 20 });

  // Store secret temporarily (not enabled yet)
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret.base32 } });

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url!);
  return res.json({ qrCode: qrDataUrl, secret: secret.base32 });
});

// ─── POST /api/auth/2fa/enable ────────────────────────────────────────────────
authRouter.post('/2fa/enable', requireAuth, async (req: Request, res: Response) => {
  const { code } = req.body;
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpSecret) return res.status(400).json({ error: 'אין סוד זמני — בצע setup תחילה' });

  const valid = speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token: code, window: 1 });
  if (!valid) return res.status(400).json({ error: 'קוד שגוי' });

  await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
  return res.json({ success: true, message: 'אימות דו-שלבי הופעל בהצלחה' });
});

// ─── POST /api/auth/2fa/disable ───────────────────────────────────────────────
authRouter.post('/2fa/disable', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null } });
  return res.json({ success: true });
});

// ─── GET /api/auth/2fa/status ─────────────────────────────────────────────────
authRouter.get('/2fa/status', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  return res.json({ enabled: user?.totpEnabled ?? false });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
// Send a password reset link via email
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  // Always return success to prevent email enumeration
  if (!email?.trim()) return res.json({ success: true, message: 'אם הכתובת קיימת במערכת, נשלח קישור לאיפוס' });

  // Throttle reset-email flooding per address (still returns the uniform success msg).
  if (tooManyAttempts(`forgot:${email.trim().toLowerCase()}`, 4, 60 * 60 * 1000)) {
    return res.json({ success: true, message: 'אם הכתובת קיימת במערכת, נשלח קישור לאיפוס' });
  }

  try {
    // Find tenant by email
    const tenant = await prisma.tenant.findFirst({ where: { email: email.trim().toLowerCase() } });
    if (tenant) {
      // Find admin user of this tenant (ADMIN or SUPER_ADMIN)
      const user = await prisma.user.findFirst({ where: { tenantId: tenant.id, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, active: true } });
      if (user) {
        // Invalidate any prior unused reset tokens so only the newest link works.
        await prisma.passwordResetToken.updateMany({
          where: { userId: user.id, used: false },
          data: { used: true },
        });

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.passwordResetToken.create({
          data: { userId: user.id, token, expiresAt },
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        await sendMail(
          email.trim(),
          'איפוס סיסמה — WA Lead CRM',
          `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">WA Lead CRM</h2>
            <p>שלום ${user.username},</p>
            <p>קיבלנו בקשה לאיפוס הסיסמה שלך.</p>
            <p>לחץ על הכפתור למטה לאיפוס:</p>
            <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
              איפוס סיסמה
            </a>
            <p style="color: #64748b; font-size: 12px;">הקישור תקף לשעה אחת בלבד.</p>
            <p style="color: #64748b; font-size: 12px;">אם לא ביקשת איפוס, התעלם מהודעה זו.</p>
          </div>
          `
        );
      }
    }
  } catch (err) {
    console.error('Forgot password error:', err);
  }

  return res.json({ success: true, message: 'אם הכתובת קיימת במערכת, נשלח קישור לאיפוס' });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
// Reset password using a token from email link
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'חסרים פרטים' });

  if (tooManyAttempts(`reset:${String(token).slice(0, 32)}`, 8, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'יותר מדי ניסיונות. נסה שוב בעוד מספר דקות.' });
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken) return res.status(400).json({ error: 'קישור לא תקין' });
  if (resetToken.used) return res.status(400).json({ error: 'הקישור כבר נוצל' });
  if (resetToken.expiresAt < new Date()) return res.status(400).json({ error: 'הקישור פג תוקף' });

  const errors = validatePassword(newPassword);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash: newHash } });
  await prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } });

  return res.json({ success: true, message: 'הסיסמה אופסה בהצלחה' });
});

// ─── POST /api/auth/change-password ───────────────────────────────────────────
authRouter.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'הסיסמה הנוכחית שגויה' });

  const errors = validatePassword(newPassword ?? '');
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  return res.json({ success: true, message: 'הסיסמה שונתה בהצלחה' });
});
