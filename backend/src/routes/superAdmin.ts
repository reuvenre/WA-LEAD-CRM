import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { requireSuperAdmin } from '../middleware/auth';
import { validatePassword } from './auth';

export const superAdminRouter = Router();

// All routes here require SUPER_ADMIN role
superAdminRouter.use(requireSuperAdmin);

// GET /api/super-admin/tenants — list all tenants
superAdminRouter.get('/tenants', async (_req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, plan: true, active: true, createdAt: true,
      greenApiInstanceId: true,
      _count: { select: { users: true, leads: true } },
    },
  });
  return res.json(tenants);
});

// PATCH /api/super-admin/tenants/:id — update plan / active status
superAdminRouter.patch('/tenants/:id', async (req: Request, res: Response) => {
  const { plan, active } = req.body;
  const tenant = await prisma.tenant.update({
    where: { id: req.params.id },
    data: { ...(plan && { plan }), ...(active !== undefined && { active }) },
  });
  return res.json(tenant);
});

// DELETE /api/super-admin/tenants/:id — delete tenant and all data
superAdminRouter.delete('/tenants/:id', async (req: Request, res: Response) => {
  await prisma.tenant.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

// GET /api/super-admin/tenants/:id/users — list all users of a tenant
superAdminRouter.get('/tenants/:id/users', async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.params.id },
    select: { id: true, username: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return res.json(users);
});

// PATCH /api/super-admin/users/:id — toggle active / change role
superAdminRouter.patch('/users/:id', async (req: Request, res: Response) => {
  const { active, role } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  // Prevent a super-admin from locking themselves out (self-demotion / self-deactivation).
  if (user.id === req.user!.userId && ((role && role !== 'SUPER_ADMIN') || active === false)) {
    return res.status(400).json({ error: 'לא ניתן לשנות את ההרשאות או לכבות את החשבון של עצמך' });
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { ...(active !== undefined && { active }), ...(role && { role }) },
    select: { id: true, username: true, role: true, active: true },
  });
  return res.json(updated);
});

// POST /api/super-admin/users/:id/reset-password — admin resets user password
superAdminRouter.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  const { newPassword } = req.body;
  const pwErrors = validatePassword(newPassword ?? '');
  if (pwErrors.length) return res.status(400).json({ error: pwErrors.join(', ') });

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });

  return res.json({ success: true, message: 'הסיסמה אופסה בהצלחה' });
});

// DELETE /api/super-admin/users/:id — delete a user
superAdminRouter.delete('/users/:id', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });
  if (user.id === req.user!.userId) {
    return res.status(400).json({ error: 'לא ניתן למחוק את החשבון של עצמך' });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

// GET /api/super-admin/stats — platform-wide stats
superAdminRouter.get('/stats', async (_req: Request, res: Response) => {
  const [totalTenants, activeTenants, totalLeads, totalMessages] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { active: true } }),
    prisma.lead.count(),
    prisma.message.count(),
  ]);

  return res.json({ totalTenants, activeTenants, totalLeads, totalMessages });
});
