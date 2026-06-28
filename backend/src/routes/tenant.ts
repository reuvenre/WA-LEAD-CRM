import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const tenantRouter = Router();

// GET /api/tenant/settings — get current tenant's settings
tenantRouter.get('/settings', async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: {
      id: true, name: true, email: true, plan: true, active: true,
      greenApiInstanceId: true, greenApiToken: true, greenApiWebhookUrl: true,
      createdAt: true,
    },
  });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  return res.json(tenant);
});

// PATCH /api/tenant/profile — update tenant name & email
tenantRouter.patch('/profile', async (req: Request, res: Response) => {
  const { name, email } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'שם חברה נדרש' });
  if (!email?.trim()) return res.status(400).json({ error: 'אימייל נדרש' });

  // Check email uniqueness (excluding current tenant)
  const existing = await prisma.tenant.findFirst({
    where: { email: email.trim().toLowerCase(), NOT: { id: req.user!.tenantId } },
  });
  if (existing) return res.status(409).json({ error: 'כתובת האימייל כבר בשימוש' });

  const tenant = await prisma.tenant.update({
    where: { id: req.user!.tenantId },
    data: { name: name.trim(), email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true },
  });

  return res.json({ success: true, tenant });
});

// PATCH /api/tenant/green-api — update Green API credentials
tenantRouter.patch('/green-api', async (req: Request, res: Response) => {
  const { greenApiInstanceId, greenApiToken, greenApiWebhookUrl } = req.body;

  const tenant = await prisma.tenant.update({
    where: { id: req.user!.tenantId },
    data: {
      greenApiInstanceId: greenApiInstanceId?.trim() || null,
      greenApiToken: greenApiToken?.trim() || null,
      greenApiWebhookUrl: greenApiWebhookUrl?.trim() || null,
    },
    select: { id: true, greenApiInstanceId: true, greenApiWebhookUrl: true },
  });

  // Auto-configure the Green API instance to deliver BOTH incoming and outgoing
  // (phone-sent) message webhooks to our endpoint — so replies the user sends from
  // their phone show up in the CRM. Best-effort: never fail the save on this.
  let webhooksConfigured = false;
  const id = greenApiInstanceId?.trim();
  const token = greenApiToken?.trim();
  const hookUrl = greenApiWebhookUrl?.trim();
  if (id && token) {
    try {
      const r = await fetch(`https://api.green-api.com/waInstance${id}/setSettings/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(hookUrl ? { webhookUrl: hookUrl } : {}),
          incomingWebhook: 'yes',
          outgoingWebhook: 'yes',            // delivery/read status receipts
          outgoingMessageWebhook: 'yes',     // messages sent from the phone
          outgoingAPIMessageWebhook: 'no',   // sent via our API — already stored
          stateWebhook: 'no',
        }),
      });
      webhooksConfigured = r.ok;
      if (!r.ok) console.warn(`Green API setSettings HTTP ${r.status}`);
    } catch (e) {
      console.warn('Green API setSettings failed:', (e as Error).message);
    }
  }

  return res.json({ success: true, tenant, webhooksConfigured });
});

// POST /api/tenant/green-api/test — validate credentials against Green API itself.
// Tests the values sent in the body (which may be unsaved form values) by calling
// Green API's getStateInstance. Returns the instance state so the UI can tell the
// user whether the device is authorized and ready to send.
tenantRouter.post('/green-api/test', async (req: Request, res: Response) => {
  const instanceId = String(req.body?.greenApiInstanceId ?? '').trim();
  const token = String(req.body?.greenApiToken ?? '').trim();

  if (!instanceId || !token) return res.status(400).json({ ok: false, error: 'נדרשים Instance ID ו-Token' });
  if (!/^\d+$/.test(instanceId)) return res.status(400).json({ ok: false, error: 'Instance ID חייב להכיל ספרות בלבד' });

  try {
    const url = `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${encodeURIComponent(token)}`;
    const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });

    if (r.status === 401 || r.status === 403) {
      return res.json({ ok: false, state: null, error: 'אימות נכשל — Instance ID או Token שגויים' });
    }
    if (!r.ok) {
      return res.json({ ok: false, state: null, error: `Green API החזיר שגיאה (HTTP ${r.status})` });
    }

    const data = (await r.json()) as { stateInstance?: string };
    const state = data.stateInstance ?? 'unknown';
    return res.json({ ok: state === 'authorized', state });
  } catch {
    return res.json({ ok: false, state: null, error: 'לא ניתן להתחבר ל-Green API (timeout / רשת)' });
  }
});

// GET /api/tenant/users — list users in this tenant
tenantRouter.get('/users', async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.user!.tenantId },
    select: { id: true, username: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return res.json(users);
});

// POST /api/tenant/users — add a new agent to this tenant (admin only)
tenantRouter.post('/users', async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'רק מנהל יכול להוסיף משתמשים' });
  }

  const bcrypt = await import('bcryptjs');
  const { username, password, role } = req.body;

  if (!username?.trim() || !password) return res.status(400).json({ error: 'נדרשים שם משתמש וסיסמה' });

  // A tenant admin may only create AGENT or ADMIN users — never a platform SUPER_ADMIN.
  const safeRole = role === 'ADMIN' ? 'ADMIN' : 'AGENT';

  const existing = await prisma.user.findFirst({
    where: { tenantId: req.user!.tenantId, username: username.trim() },
  });
  if (existing) return res.status(409).json({ error: 'שם משתמש כבר קיים' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { tenantId: req.user!.tenantId, username: username.trim(), passwordHash, role: safeRole },
    select: { id: true, username: true, role: true, active: true, createdAt: true },
  });

  return res.status(201).json(user);
});

// PATCH /api/tenant/users/:id — toggle active / change role
tenantRouter.patch('/users/:id', async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'רק מנהל יכול לערוך משתמשים' });
  }

  const user = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  const { active, role } = req.body;
  // A tenant admin may only assign AGENT or ADMIN — never escalate to SUPER_ADMIN.
  const safeRole = role === undefined ? undefined : role === 'ADMIN' ? 'ADMIN' : 'AGENT';
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { ...(active !== undefined && { active }), ...(safeRole && { role: safeRole }) },
    select: { id: true, username: true, role: true, active: true },
  });

  return res.json(updated);
});

// DELETE /api/tenant/users/:id — remove an agent from this tenant (admin only)
tenantRouter.delete('/users/:id', async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'רק מנהל יכול להסיר משתמשים' });
  }
  if (req.params.id === req.user!.userId) {
    return res.status(400).json({ error: 'לא ניתן להסיר את עצמך' });
  }

  const user = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
  // A tenant admin cannot remove a platform super-admin.
  if (user.role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'לא ניתן להסיר מנהל-על' });
  }

  await prisma.user.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});
