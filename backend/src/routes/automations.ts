import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { isSafeWebhookUrl } from '../lib/ssrf';
import { isManager, canAccessLead } from '../middleware/auth';
import { checkLimit } from '../lib/entitlements';

export const automationsRouter = Router();

// Webhook CRUD is manager-only: a registered webhook receives lead + message events
// for the WHOLE tenant, so letting an agent point one at their own server would hand
// them every other agent's leads and conversations.
function requireManager(req: Request, res: Response): boolean {
  if (isManager(req)) return true;
  res.status(403).json({ error: 'רק מנהל יכול לנהל אוטומציות' });
  return false;
}

// Fields a client is allowed to update on a lead via the automation trigger.
const ALLOWED_LEAD_FIELDS = ['status', 'priority', 'assignedTo', 'internalNotes', 'tags', 'projectId'] as const;

automationsRouter.get('/', async (req: Request, res: Response) => {
  if (!requireManager(req, res)) return;
  const tenantId = req.user!.tenantId;
  const hooks = await prisma.automationWebhook.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  return res.json(hooks);
});

automationsRouter.post('/', async (req: Request, res: Response) => {
  if (!requireManager(req, res)) return;
  const tenantId = req.user!.tenantId;
  const { name, url, events } = req.body;
  if (!name || !url || !events?.length) return res.status(400).json({ error: 'name, url, events required' });
  if (!isSafeWebhookUrl(url)) return res.status(400).json({ error: 'כתובת ה-webhook אינה חוקית או מצביעה על כתובת פנימית' });
  if (!(await checkLimit(req, res, 'automationWebhook'))) return;
  const hook = await prisma.automationWebhook.create({ data: { tenantId, name, url, events } });
  return res.status(201).json(hook);
});

automationsRouter.patch('/:id', async (req: Request, res: Response) => {
  if (!requireManager(req, res)) return;
  const tenantId = req.user!.tenantId;
  const existing = await prisma.automationWebhook.findFirst({ where: { id: req.params.id, tenantId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const hook = await prisma.automationWebhook.update({ where: { id: req.params.id }, data: { active: req.body.active } });
  return res.json(hook);
});

automationsRouter.delete('/:id', async (req: Request, res: Response) => {
  if (!requireManager(req, res)) return;
  const tenantId = req.user!.tenantId;
  const existing = await prisma.automationWebhook.findFirst({ where: { id: req.params.id, tenantId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await prisma.automationWebhook.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

automationsRouter.post('/trigger', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const { action, leadId, data } = req.body;
  try {
    if (action === 'update_lead' && leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      // Same per-agent scoping as PATCH /leads/:id — without it an agent could
      // reassign/alter any lead in the tenant (e.g. steal a colleague's lead).
      if (!canAccessLead(req, lead.assignedTo)) return res.status(403).json({ error: 'אין הרשאה לליד זה' });
      if (data?.assignedTo !== undefined && !isManager(req)) {
        return res.status(403).json({ error: 'רק מנהל יכול לשייך לידים' });
      }
      // Whitelist updatable fields — never let the caller touch tenantId, id, timestamps, etc.
      const safeData: Record<string, unknown> = {};
      if (data && typeof data === 'object') {
        for (const field of ALLOWED_LEAD_FIELDS) {
          if (data[field] !== undefined) safeData[field] = data[field];
        }
      }
      const updated = await prisma.lead.update({ where: { id: leadId }, data: safeData });
      return res.json({ success: true, lead: updated });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
