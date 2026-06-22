import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { isSafeWebhookUrl } from '../lib/ssrf';

export const automationsRouter = Router();

// Fields a client is allowed to update on a lead via the automation trigger.
const ALLOWED_LEAD_FIELDS = ['status', 'priority', 'assignedTo', 'internalNotes', 'tags', 'projectId'] as const;

automationsRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const hooks = await prisma.automationWebhook.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  return res.json(hooks);
});

automationsRouter.post('/', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const { name, url, events } = req.body;
  if (!name || !url || !events?.length) return res.status(400).json({ error: 'name, url, events required' });
  if (!isSafeWebhookUrl(url)) return res.status(400).json({ error: 'כתובת ה-webhook אינה חוקית או מצביעה על כתובת פנימית' });
  const hook = await prisma.automationWebhook.create({ data: { tenantId, name, url, events } });
  return res.status(201).json(hook);
});

automationsRouter.patch('/:id', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const existing = await prisma.automationWebhook.findFirst({ where: { id: req.params.id, tenantId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const hook = await prisma.automationWebhook.update({ where: { id: req.params.id }, data: { active: req.body.active } });
  return res.json(hook);
});

automationsRouter.delete('/:id', async (req: Request, res: Response) => {
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
