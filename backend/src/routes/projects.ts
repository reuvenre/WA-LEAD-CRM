import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const projectsRouter = Router();

// GET /api/projects — list all projects for tenant
projectsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const projects = await prisma.project.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true } } },
    });
    return res.json(projects);
  } catch (error) {
    console.error('GET /projects error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects — create a project
projectsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, description, color } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'נדרש שם פרויקט' });

    const existing = await prisma.project.findFirst({ where: { tenantId, name: name.trim() } });
    if (existing) return res.status(409).json({ error: 'פרויקט עם שם זה כבר קיים' });

    const project = await prisma.project.create({
      data: { tenantId, name: name.trim(), description: description?.trim() || null, color: color || '#3B82F6' },
      include: { _count: { select: { leads: true } } },
    });

    return res.status(201).json(project);
  } catch (error) {
    console.error('POST /projects error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/projects/:id — update a project
projectsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.project.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'פרויקט לא נמצא' });

    const { name, description, color, active } = req.body;
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(color && { color }),
        ...(active !== undefined && { active }),
      },
      include: { _count: { select: { leads: true } } },
    });

    return res.json(project);
  } catch (error) {
    console.error('PATCH /projects/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id — delete a project (leads get projectId = null)
projectsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.project.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'פרויקט לא נמצא' });

    await prisma.project.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /projects/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/leads — list leads for a specific project
projectsRouter.get('/:id/leads', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const leads = await prisma.lead.findMany({
      where: { tenantId, projectId: req.params.id },
      orderBy: { lastMessageAt: 'desc' },
      include: { messages: { orderBy: { timestamp: 'desc' }, take: 1 } },
    });
    return res.json(leads);
  } catch (error) {
    console.error('GET /projects/:id/leads error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
