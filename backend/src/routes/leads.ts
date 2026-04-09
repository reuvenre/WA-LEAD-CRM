import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { LeadStatus, Priority } from '@prisma/client';
import { SOCKET_EVENTS } from '../socket';
import { Server as SocketIOServer } from 'socket.io';

export const leadsRouter = Router();

// ─── GET /leads ───────────────────────────────────────────────────────────────
// Query params: status, search, page, limit
leadsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: Record<string, unknown> = {};

    if (status && status !== 'all') {
      where.status = status as LeadStatus;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: parseInt(limit as string),
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return res.json({ leads, total, page: parseInt(page as string) });
  } catch (error) {
    console.error('GET /leads error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /leads/:id ───────────────────────────────────────────────────────────
leadsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    return res.json(lead);
  } catch (error) {
    console.error('GET /leads/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /leads/:id ────────────────────────────────────────────────────────
leadsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status, priority, internalNotes, assignedTo } = req.body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status as LeadStatus;
    if (priority !== undefined) updateData.priority = priority as Priority;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Emit real-time update
    const io: SocketIOServer = req.app.get('io');
    io.emit(SOCKET_EVENTS.LEAD_UPDATED, lead);

    return res.json(lead);
  } catch (error) {
    console.error('PATCH /leads/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /leads/:id ───────────────────────────────────────────────────────
leadsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /leads/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
