// Broadcast campaign management (manager-only, gated by the `broadcast` feature).
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { isManager } from '../middleware/auth';
import { audienceWhere, startCampaign, parseSteps, type CampaignFilter } from '../lib/campaigns';

export const campaignsRouter = Router();

// Broadcasting is a manager action across the whole tenant.
campaignsRouter.use((req: Request, res: Response, next) => {
  if (!isManager(req)) return res.status(403).json({ error: 'רק מנהל יכול לנהל קמפיינים' });
  return next();
});

async function statsFor(campaignId: string) {
  const rows = await prisma.campaignRecipient.groupBy({ by: ['status'], where: { campaignId }, _count: { status: true } });
  const s: Record<string, number> = { pending: 0, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0 };
  let total = 0;
  for (const r of rows) { s[r.status] = r._count.status; total += r._count.status; }
  return { ...s, total };
}

// ─── GET /campaigns ───────────────────────────────────────────────────────────
campaignsRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const campaigns = await prisma.campaign.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  const withStats = await Promise.all(campaigns.map(async (c) => ({ ...c, stats: await statsFor(c.id) })));
  return res.json(withStats);
});

// ─── POST /campaigns — create a draft ────────────────────────────────────────
campaignsRouter.post('/', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const { name, body, filter, steps, scheduledAt } = req.body as {
    name?: string; body?: string; filter?: CampaignFilter; steps?: unknown; scheduledAt?: string;
  };
  if (!name?.trim()) return res.status(400).json({ error: 'שם קמפיין נדרש' });

  const campaign = await prisma.campaign.create({
    data: {
      tenantId, name: name.trim(), body: (body ?? '').slice(0, 4000),
      filter: (filter ?? {}) as object,
      steps: steps ? (steps as object) : undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdBy: req.user!.username,
      status: 'draft',
    },
  });
  return res.status(201).json({ ...campaign, stats: await statsFor(campaign.id) });
});

// ─── GET /campaigns/:id ───────────────────────────────────────────────────────
campaignsRouter.get('/:id', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
  if (!campaign) return res.status(404).json({ error: 'קמפיין לא נמצא' });
  return res.json({ ...campaign, stats: await statsFor(campaign.id) });
});

// ─── PATCH /campaigns/:id — edit (draft only) ────────────────────────────────
campaignsRouter.patch('/:id', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
  if (!campaign) return res.status(404).json({ error: 'קמפיין לא נמצא' });
  if (campaign.status !== 'draft') return res.status(400).json({ error: 'ניתן לערוך רק קמפיין בטיוטה' });

  const { name, body, filter, steps, scheduledAt } = req.body as {
    name?: string; body?: string; filter?: CampaignFilter; steps?: unknown; scheduledAt?: string | null;
  };
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name).trim().slice(0, 120);
  if (body !== undefined) data.body = String(body).slice(0, 4000);
  if (filter !== undefined) data.filter = (filter ?? {}) as object;
  if (steps !== undefined) data.steps = steps ? (steps as object) : undefined;
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

  const updated = await prisma.campaign.update({ where: { id: campaign.id }, data });
  return res.json({ ...updated, stats: await statsFor(campaign.id) });
});

// ─── POST /campaigns/:id/preview — audience count + sample ───────────────────
campaignsRouter.post('/:id/preview', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
  if (!campaign) return res.status(404).json({ error: 'קמפיין לא נמצא' });

  const where = audienceWhere(tenantId, campaign.filter as CampaignFilter | null);
  const [count, sample] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, select: { name: true, phone: true }, take: 5, orderBy: { lastMessageAt: 'desc' } }),
  ]);
  return res.json({ count, sample });
});

// ─── POST /campaigns/:id/send — materialize + start (or schedule) ────────────
campaignsRouter.post('/:id/send', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
  if (!campaign) return res.status(404).json({ error: 'קמפיין לא נמצא' });
  if (!['draft', 'paused'].includes(campaign.status)) return res.status(400).json({ error: 'הקמפיין כבר רץ או הסתיים' });
  // A campaign is either a one-shot broadcast (body) or a drip sequence (steps).
  if (!campaign.body.trim() && parseSteps(campaign.steps).length === 0) {
    return res.status(400).json({ error: 'אין תוכן להודעה' });
  }

  const audience = await startCampaign(tenantId, campaign.id);
  return res.json({ success: true, audience });
});

// ─── POST /campaigns/:id/pause & /resume ─────────────────────────────────────
campaignsRouter.post('/:id/pause', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
  if (!campaign) return res.status(404).json({ error: 'קמפיין לא נמצא' });
  if (!['running', 'scheduled'].includes(campaign.status)) return res.status(400).json({ error: 'הקמפיין אינו פעיל' });
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'paused' } });
  return res.json({ success: true });
});

campaignsRouter.post('/:id/resume', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
  if (!campaign) return res.status(404).json({ error: 'קמפיין לא נמצא' });
  if (campaign.status !== 'paused') return res.status(400).json({ error: 'רק קמפיין מושהה ניתן להמשך' });
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'running' } });
  const { enqueueJob } = await import('../lib/jobs');
  await enqueueJob(tenantId, 'campaign_send', new Date(), { campaignId: campaign.id });
  return res.json({ success: true });
});

// ─── DELETE /campaigns/:id ───────────────────────────────────────────────────
campaignsRouter.delete('/:id', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, tenantId } });
  if (!campaign) return res.status(404).json({ error: 'קמפיין לא נמצא' });
  await prisma.campaign.delete({ where: { id: campaign.id } }); // recipients cascade
  return res.status(204).send();
});
