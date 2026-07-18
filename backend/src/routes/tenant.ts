import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { checkLimit, entitlementsFor, trialStatusOf } from '../lib/entitlements';

export const tenantRouter = Router();

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const MANAGER_ROLES = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'];

// Company-level actions reserved for true admins (profile, plan, managing admins).
function requireTenantAdmin(req: Request, res: Response): boolean {
  if (!ADMIN_ROLES.includes(req.user!.role)) {
    res.status(403).json({ error: 'רק אדמין יכול לבצע פעולה זו' });
    return false;
  }
  return true;
}

// Manager-level actions (WhatsApp connection, agent management, templates).
function requireTenantManager(req: Request, res: Response): boolean {
  if (!MANAGER_ROLES.includes(req.user!.role)) {
    res.status(403).json({ error: 'רק מנהל יכול לבצע פעולה זו' });
    return false;
  }
  return true;
}

// GET /api/tenant/settings — get current tenant's settings.
// The Green API token is a full WhatsApp credential and is NEVER returned to the
// client — only a boolean saying whether one is configured (write-only from the UI).
tenantRouter.get('/settings', async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: {
      id: true, name: true, email: true, plan: true, active: true,
      greenApiInstanceId: true, greenApiToken: true, greenApiWebhookUrl: true,
      assignmentMode: true, autoReplies: true, slaTargetMinutes: true, attributeDefs: true,
      createdAt: true,
    },
  });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const isMgr = MANAGER_ROLES.includes(req.user!.role);
  // Agents get only what their UI needs (custom-field definitions, plan, identity).
  // The Green API instanceId + webhook wiring stay manager-only: the instanceId is
  // half of the webhook-forgery equation, and agents have no settings screen anyway.
  if (!isMgr) {
    return res.json({
      id: tenant.id, name: tenant.name, email: tenant.email, plan: tenant.plan,
      active: tenant.active, attributeDefs: tenant.attributeDefs, createdAt: tenant.createdAt,
    });
  }

  const { greenApiToken, greenApiWebhookUrl, ...safe } = tenant;
  return res.json({
    ...safe,
    greenApiTokenSet: Boolean(greenApiToken),
    // Strip any embedded ?token= secret before echoing the webhook URL back.
    greenApiWebhookUrl: greenApiWebhookUrl ? greenApiWebhookUrl.split('?')[0] : null,
  });
});

// PATCH /api/tenant/engagement — round-robin assignment + auto-reply config (manager).
// Gated by plan features (autoReplies / roundRobin) so downgraded tenants can't enable.
tenantRouter.patch('/engagement', async (req: Request, res: Response) => {
  if (!requireTenantManager(req, res)) return;
  const feats = entitlementsFor((await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId }, select: { plan: true },
  }))?.plan ?? 'TRIAL').features;

  const { assignmentMode, autoReplies, slaTargetMinutes, attributeDefs } = req.body as {
    assignmentMode?: string; autoReplies?: unknown; slaTargetMinutes?: number; attributeDefs?: unknown;
  };
  const data: Record<string, unknown> = {};

  if (slaTargetMinutes !== undefined) {
    const n = Math.round(Number(slaTargetMinutes));
    if (!Number.isFinite(n) || n < 1 || n > 1440) return res.status(400).json({ error: 'יעד SLA חייב להיות בין 1 ל-1440 דקות' });
    data.slaTargetMinutes = n;
  }

  if (attributeDefs !== undefined) {
    if (!feats.customAttributes) {
      return res.status(403).json({ error: 'שדות מותאמים אינם כלולים במסלול הנוכחי — נדרש שדרוג', upgrade: true });
    }
    if (!Array.isArray(attributeDefs)) return res.status(400).json({ error: 'הגדרת שדות לא תקינה' });
    // Normalize + validate each definition; a stable `key` is required and unique.
    const seen = new Set<string>();
    const defs: Array<{ key: string; label: string; type: string; options?: string[] }> = [];
    for (const raw of attributeDefs as Array<Record<string, unknown>>) {
      const key = String(raw.key ?? '').trim().slice(0, 40);
      const label = String(raw.label ?? '').trim().slice(0, 60);
      const type = ['text', 'number', 'select'].includes(String(raw.type)) ? String(raw.type) : 'text';
      if (!key || !label || seen.has(key)) continue;
      seen.add(key);
      const def: { key: string; label: string; type: string; options?: string[] } = { key, label, type };
      if (type === 'select' && Array.isArray(raw.options)) {
        def.options = (raw.options as unknown[]).map((o) => String(o).trim()).filter(Boolean).slice(0, 30);
      }
      defs.push(def);
      if (defs.length >= 30) break; // cap the number of custom fields
    }
    data.attributeDefs = defs;
  }

  if (assignmentMode !== undefined) {
    const mode = assignmentMode === 'round_robin' ? 'round_robin' : 'manual';
    if (mode === 'round_robin' && !feats.roundRobin) {
      return res.status(403).json({ error: 'ניתוב אוטומטי אינו כלול במסלול הנוכחי — נדרש שדרוג', upgrade: true });
    }
    data.assignmentMode = mode;
  }

  if (autoReplies !== undefined) {
    if (!feats.autoReplies) {
      return res.status(403).json({ error: 'מענה אוטומטי אינו כלול במסלול הנוכחי — נדרש שדרוג', upgrade: true });
    }
    // Store as-is (JSON); the shape is validated/normalized when consumed in lib/autoReply.ts.
    data.autoReplies = autoReplies === null ? undefined : (autoReplies as object);
  }

  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'אין שינויים' });

  await prisma.tenant.update({ where: { id: req.user!.tenantId }, data });
  return res.json({ success: true });
});

// GET /api/tenant/entitlements — the resolved plan limits + features + current usage,
// so the UI can lock/grey gated features instead of only erroring on submit.
tenantRouter.get('/entitlements', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, trialEndsAt: true } });
  const ent = entitlementsFor(tenant?.plan ?? 'TRIAL');
  const [users, leads, lines] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId } }),
    prisma.line.count({ where: { tenantId } }),
  ]);
  return res.json({
    plan: tenant?.plan ?? 'TRIAL',
    entitlements: ent,
    usage: { users, leads, lines },
    trial: trialStatusOf(tenant ?? { plan: 'TRIAL', trialEndsAt: null }),
  });
});

// PATCH /api/tenant/profile — update tenant name & email (admin only)
tenantRouter.patch('/profile', async (req: Request, res: Response) => {
  if (!requireTenantAdmin(req, res)) return;
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

// PATCH /api/tenant/green-api — update Green API credentials (manager or admin)
tenantRouter.patch('/green-api', async (req: Request, res: Response) => {
  if (!requireTenantManager(req, res)) return;
  const { greenApiInstanceId, greenApiToken, greenApiWebhookUrl } = req.body;

  // The token is write-only: an empty/omitted token keeps the stored one, so the
  // admin can change the instance id or webhook without re-typing the secret.
  const current = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { greenApiToken: true, webhookSecret: true },
  });

  const id = greenApiInstanceId?.trim() || null;
  const token = greenApiToken?.trim() ? greenApiToken.trim() : (current?.greenApiToken ?? null);
  const hookBase = greenApiWebhookUrl?.trim() ? greenApiWebhookUrl.trim().split('?')[0] : null;

  // First persist the plain credentials (no secret yet) so a failed setSettings
  // never leaves us enforcing a secret Green API isn't sending.
  await prisma.tenant.update({
    where: { id: req.user!.tenantId },
    data: { greenApiInstanceId: id, greenApiToken: token, greenApiWebhookUrl: hookBase },
  });

  // Auto-configure the Green API instance to deliver BOTH incoming and outgoing
  // (phone-sent) message webhooks to our endpoint. Best-effort: never fail the save.
  let webhooksConfigured = false;
  if (id && token) {
    // Reuse an existing secret or mint a new one; only commit it if setSettings succeeds.
    const secret = current?.webhookSecret || crypto.randomBytes(24).toString('hex');
    const hookUrl = hookBase ? `${hookBase}?token=${secret}` : null;
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
      if (r.ok && hookUrl) {
        // Green API now posts with ?token=secret — safe to enforce it on our side.
        await prisma.tenant.update({
          where: { id: req.user!.tenantId },
          data: { webhookSecret: secret, greenApiWebhookUrl: hookUrl },
        });
      } else if (!r.ok) {
        console.warn(`Green API setSettings HTTP ${r.status}`);
      }
    } catch (e) {
      console.warn('Green API setSettings failed:', (e as Error).message);
    }
  }

  return res.json({ success: true, webhooksConfigured });
});

// POST /api/tenant/green-api/test — validate credentials against Green API itself.
// Tests the values sent in the body (which may be unsaved form values) by calling
// Green API's getStateInstance. Returns the instance state so the UI can tell the
// user whether the device is authorized and ready to send.
tenantRouter.post('/green-api/test', async (req: Request, res: Response) => {
  if (!requireTenantManager(req, res)) return; // settings screen is manager-only
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

// GET /api/tenant/widget — website-chat-widget config + embed snippet (manager).
tenantRouter.get('/widget', async (req: Request, res: Response) => {
  if (!requireTenantManager(req, res)) return;
  const tenantId = req.user!.tenantId;
  const feats = entitlementsFor((await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }))?.plan ?? 'TRIAL').features;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { widgetKey: true, widgetEnabled: true, widgetConfig: true } });
  const apiBase = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const snippet = t?.widgetKey
    ? `<script src="${apiBase}/widget.js" data-key="${t.widgetKey}" async></script>`
    : null;
  return res.json({
    available: feats.webchat,
    enabled: t?.widgetEnabled ?? false,
    hasKey: Boolean(t?.widgetKey),
    config: t?.widgetConfig ?? null,
    snippet,
  });
});

// PATCH /api/tenant/widget — enable/configure the widget; mints a key on first enable.
tenantRouter.patch('/widget', async (req: Request, res: Response) => {
  if (!requireTenantManager(req, res)) return;
  const tenantId = req.user!.tenantId;
  const feats = entitlementsFor((await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }))?.plan ?? 'TRIAL').features;
  if (!feats.webchat) return res.status(403).json({ error: 'צ׳אט לאתר אינו כלול במסלול הנוכחי — נדרש שדרוג', upgrade: true });

  const { enabled, config } = req.body as { enabled?: boolean; config?: { title?: string; greeting?: string; color?: string } };
  const current = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { widgetKey: true } });
  const data: Record<string, unknown> = {};

  if (enabled !== undefined) {
    data.widgetEnabled = Boolean(enabled);
    // Mint a public key the first time the widget is switched on.
    if (enabled && !current?.widgetKey) data.widgetKey = 'wk_' + crypto.randomBytes(16).toString('hex');
  }
  if (config !== undefined) {
    data.widgetConfig = {
      title: String(config?.title ?? '').slice(0, 60) || 'צ׳אט עם נציג',
      greeting: String(config?.greeting ?? '').slice(0, 300),
      color: /^#[0-9a-fA-F]{6}$/.test(config?.color ?? '') ? config!.color : '#25D366',
    };
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'אין שינויים' });

  await prisma.tenant.update({ where: { id: tenantId }, data });
  return res.json({ success: true });
});

// GET /api/tenant/users — list users in this tenant
tenantRouter.get('/users', async (req: Request, res: Response) => {
  // The full roster (roles + active flags) is management data — agents don't need it
  // (they can't assign leads) and it mapped the org for anyone with an agent login.
  if (!requireTenantManager(req, res)) return;
  const users = await prisma.user.findMany({
    where: { tenantId: req.user!.tenantId },
    select: { id: true, username: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return res.json(users);
});

// POST /api/tenant/users — add a user (manager or admin)
tenantRouter.post('/users', async (req: Request, res: Response) => {
  if (!requireTenantManager(req, res)) return;
  if (!(await checkLimit(req, res, 'user'))) return; // plan seat limit

  const bcrypt = await import('bcryptjs');
  const { username, password, role } = req.body;

  if (!username?.trim() || !password) return res.status(400).json({ error: 'נדרשים שם משתמש וסיסמה' });

  // Admins may create AGENT / MANAGER / ADMIN. A MANAGER may only create AGENTs.
  const actorIsAdmin = ADMIN_ROLES.includes(req.user!.role);
  const requested = role === 'ADMIN' ? 'ADMIN' : role === 'MANAGER' ? 'MANAGER' : 'AGENT';
  const safeRole = actorIsAdmin ? requested : 'AGENT';

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
  if (!requireTenantManager(req, res)) return;

  const user = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  const actorIsAdmin = ADMIN_ROLES.includes(req.user!.role);
  // A manager may only act on AGENTs — never touch a manager/admin.
  if (!actorIsAdmin && user.role !== 'AGENT') {
    return res.status(403).json({ error: 'רק אדמין יכול לערוך מנהלים ואדמינים' });
  }

  const { active, role } = req.body;
  // Role changes are admin-only (AGENT/MANAGER/ADMIN; never SUPER_ADMIN). Managers
  // can toggle active on agents but cannot change roles.
  const safeRole = (role === undefined || !actorIsAdmin)
    ? undefined
    : role === 'ADMIN' ? 'ADMIN' : role === 'MANAGER' ? 'MANAGER' : 'AGENT';
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { ...(active !== undefined && { active }), ...(safeRole && { role: safeRole }) },
    select: { id: true, username: true, role: true, active: true },
  });

  return res.json(updated);
});

// DELETE /api/tenant/users/:id — remove a user (manager or admin)
tenantRouter.delete('/users/:id', async (req: Request, res: Response) => {
  if (!requireTenantManager(req, res)) return;
  if (req.params.id === req.user!.userId) {
    return res.status(400).json({ error: 'לא ניתן להסיר את עצמך' });
  }

  const user = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
  if (user.role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'לא ניתן להסיר מנהל-על' });
  }
  // A manager may only remove AGENTs.
  if (!ADMIN_ROLES.includes(req.user!.role) && user.role !== 'AGENT') {
    return res.status(403).json({ error: 'רק אדמין יכול להסיר מנהלים ואדמינים' });
  }

  await prisma.user.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});
