import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const templatesRouter = Router();

// GET /templates
templatesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const templates = await prisma.template.findMany({
      where: { tenantId },
      orderBy: { category: 'asc' },
    });
    return res.json(templates);
  } catch (error) {
    console.error('GET /templates error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /templates
templatesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { title, body, category } = req.body;
    if (!title || !body || !category) {
      return res.status(400).json({ error: 'title, body, category required' });
    }
    const template = await prisma.template.create({
      data: { tenantId, title, body, category },
    });
    return res.status(201).json(template);
  } catch (error) {
    console.error('POST /templates error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /templates/:id
templatesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.template.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.template.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /templates/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
