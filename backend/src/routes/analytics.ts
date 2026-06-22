import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const analyticsRouter = Router();

analyticsRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      totalLeads, newToday, hotLeads, closedLeads, lostLeads, inProgressLeads,
      messagesToday, messagesThisWeek, avgResponseTime, leadsByStatus, leadsThisWeek, agentLeads, projectsData,
    ] = await Promise.all([
      prisma.lead.count({ where: { tenantId } }),
      prisma.lead.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { tenantId, status: 'HOT' } }),
      prisma.lead.count({ where: { tenantId, status: 'CLOSED' } }),
      prisma.lead.count({ where: { tenantId, status: 'LOST' } }),
      prisma.lead.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
      prisma.message.count({ where: { tenantId, timestamp: { gte: todayStart } } }),
      prisma.message.count({ where: { tenantId, timestamp: { gte: weekStart } } }),
      prisma.$queryRaw<Array<{ avg_minutes: number }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (out_msg.timestamp - in_msg.timestamp)) / 60) as avg_minutes
        FROM "Message" in_msg
        JOIN "Message" out_msg ON out_msg."leadId" = in_msg."leadId"
          AND out_msg.direction = 'outbound'
          AND out_msg.timestamp > in_msg.timestamp
        WHERE in_msg.direction = 'inbound'
          AND in_msg."tenantId" = ${tenantId}
          AND in_msg.timestamp >= ${weekStart}
      `,
      prisma.lead.groupBy({ by: ['status'], where: { tenantId }, _count: { status: true } }),
      prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT DATE("createdAt") as day, COUNT(*)::int as count
        FROM "Lead"
        WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${weekStart}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
      // Agents: leads per representative
      prisma.lead.groupBy({
        by: ['assignedTo'],
        where: { tenantId, assignedTo: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Projects with lead counts
      prisma.project.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, color: true, _count: { select: { leads: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const avgMinutes = avgResponseTime[0]?.avg_minutes
      ? Math.round(Number(avgResponseTime[0].avg_minutes))
      : null;

    return res.json({
      totals: { leads: totalLeads, newToday, hot: hotLeads, closed: closedLeads, lost: lostLeads, inProgress: inProgressLeads },
      messages: { today: messagesToday, thisWeek: messagesThisWeek },
      avgResponseMinutes: avgMinutes,
      leadsByStatus: leadsByStatus.map((s) => ({ status: s.status, count: s._count.status })),
      leadsThisWeek,
      agents: agentLeads.map((a) => ({ name: a.assignedTo!, leads: a._count.id })),
      projects: projectsData.map((p) => ({ id: p.id, name: p.name, color: p.color, leads: p._count.leads })),
    });
  } catch (error) {
    console.error('GET /analytics/overview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
