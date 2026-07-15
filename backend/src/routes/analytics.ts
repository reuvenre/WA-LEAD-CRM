import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isManager } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    // Managers see the whole company; an AGENT gets the same dashboard scoped to their
    // own leads/messages (no other agent's data).
    const agent = isManager(req) ? null : req.user!.username;
    const leadScope = agent ? { assignedTo: agent } : {};
    const msgScope = agent ? { lead: { assignedTo: agent } } : {};
    // Raw-SQL fragments for the scoped queries (empty for managers).
    const leadSql = agent ? Prisma.sql`AND "assignedTo" = ${agent}` : Prisma.empty;
    const inMsgSql = agent
      ? Prisma.sql`AND in_msg."leadId" IN (SELECT id FROM "Lead" WHERE "tenantId" = ${tenantId} AND "assignedTo" = ${agent})`
      : Prisma.empty;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    // SLA target (minutes) for first-response compliance.
    const tenantRow = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slaTargetMinutes: true } });
    const slaTarget = tenantRow?.slaTargetMinutes ?? 30;

    // Per-agent FIRST-response time + SLA compliance over the week. For each inbound
    // message we take the first outbound that follows it on the same lead (LATERAL),
    // attribute it to the lead's assigned agent, and aggregate. Scoped by leadSql so an
    // agent viewing their own dashboard only sees their own row.
    const responseByAgent = prisma.$queryRaw<Array<{ agent: string; avg_minutes: number; sample: number; within_sla: number }>>(Prisma.sql`
      SELECT l."assignedTo" AS agent,
             AVG(fr.gap_min) AS avg_minutes,
             COUNT(*)::int AS sample,
             SUM(CASE WHEN fr.gap_min <= ${slaTarget} THEN 1 ELSE 0 END)::int AS within_sla
      FROM "Lead" l
      JOIN LATERAL (
        SELECT EXTRACT(EPOCH FROM (o.ts - i.timestamp)) / 60 AS gap_min
        FROM "Message" i
        JOIN LATERAL (
          SELECT o.timestamp AS ts FROM "Message" o
          WHERE o."leadId" = i."leadId" AND o.direction = 'outbound' AND o.timestamp > i.timestamp
          ORDER BY o.timestamp ASC LIMIT 1
        ) o ON true
        WHERE i."leadId" = l.id AND i.direction = 'inbound' AND i.timestamp >= ${weekStart}
      ) fr ON true
      WHERE l."tenantId" = ${tenantId} AND l."assignedTo" IS NOT NULL
        ${leadSql}
      GROUP BY l."assignedTo"
    `);

    // CSAT: overall average + per-agent, over rated leads only (scoped like everything else).
    const csatByAgent = prisma.$queryRaw<Array<{ agent: string | null; avg_score: number; responses: number }>>(Prisma.sql`
      SELECT "assignedTo" AS agent, AVG("csatScore")::float AS avg_score, COUNT(*)::int AS responses
      FROM "Lead"
      WHERE "tenantId" = ${tenantId} AND "csatScore" IS NOT NULL
        ${leadSql}
      GROUP BY "assignedTo"
    `);

    const [
      totalLeads, newToday, hotLeads, closedLeads, lostLeads, inProgressLeads,
      messagesToday, messagesThisWeek, avgResponseTime, leadsByStatus, leadsThisWeek, agentLeads, projectsData,
      agentResponse, csatRows,
    ] = await Promise.all([
      prisma.lead.count({ where: { tenantId, ...leadScope } }),
      prisma.lead.count({ where: { tenantId, ...leadScope, createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { tenantId, ...leadScope, status: 'HOT' } }),
      prisma.lead.count({ where: { tenantId, ...leadScope, status: 'CLOSED' } }),
      prisma.lead.count({ where: { tenantId, ...leadScope, status: 'LOST' } }),
      prisma.lead.count({ where: { tenantId, ...leadScope, status: 'IN_PROGRESS' } }),
      prisma.message.count({ where: { tenantId, ...msgScope, timestamp: { gte: todayStart } } }),
      prisma.message.count({ where: { tenantId, ...msgScope, timestamp: { gte: weekStart } } }),
      prisma.$queryRaw<Array<{ avg_minutes: number }>>(Prisma.sql`
        SELECT AVG(EXTRACT(EPOCH FROM (out_msg.timestamp - in_msg.timestamp)) / 60) as avg_minutes
        FROM "Message" in_msg
        JOIN "Message" out_msg ON out_msg."leadId" = in_msg."leadId"
          AND out_msg.direction = 'outbound'
          AND out_msg.timestamp > in_msg.timestamp
        WHERE in_msg.direction = 'inbound'
          AND in_msg."tenantId" = ${tenantId}
          AND in_msg.timestamp >= ${weekStart}
          ${inMsgSql}
      `),
      prisma.lead.groupBy({ by: ['status'], where: { tenantId, ...leadScope }, _count: { status: true } }),
      prisma.$queryRaw<Array<{ day: string; count: number }>>(Prisma.sql`
        SELECT DATE("createdAt") as day, COUNT(*)::int as count
        FROM "Lead"
        WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${weekStart}
          ${leadSql}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `),
      // Per-agent leaderboard — managers only (an agent doesn't see other agents).
      agent
        ? Promise.resolve([] as Array<{ assignedTo: string | null; _count: { id: number } }>)
        : prisma.lead.groupBy({
            by: ['assignedTo'],
            where: { tenantId, assignedTo: { not: null } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
          }),
      // Projects with lead counts — managers only (aggregate across all agents).
      agent
        ? Promise.resolve([] as Array<{ id: string; name: string; color: string; _count: { leads: number } }>)
        : prisma.project.findMany({
            where: { tenantId, active: true },
            select: { id: true, name: true, color: true, _count: { select: { leads: true } } },
            orderBy: { createdAt: 'asc' },
          }),
      responseByAgent, csatByAgent,
    ]);

    // Index per-agent response metrics for quick lookup + a scoped overall compliance.
    const respByAgent = new Map(agentResponse.map((r) => [r.agent, r]));
    let slaSample = 0, slaWithin = 0;
    for (const r of agentResponse) { slaSample += Number(r.sample); slaWithin += Number(r.within_sla); }
    const slaCompliance = slaSample > 0 ? Math.round((slaWithin / slaSample) * 100) : null;

    // CSAT: weighted overall average across agents + a per-agent lookup.
    const csatMap = new Map(csatRows.filter((c) => c.agent).map((c) => [c.agent!, c]));
    let csatTotal = 0, csatCount = 0;
    for (const c of csatRows) { csatTotal += Number(c.avg_score) * Number(c.responses); csatCount += Number(c.responses); }
    const csatAvg = csatCount > 0 ? Math.round((csatTotal / csatCount) * 10) / 10 : null;

    const avgMinutes = avgResponseTime[0]?.avg_minutes
      ? Math.round(Number(avgResponseTime[0].avg_minutes))
      : null;

    return res.json({
      scope: agent ? 'agent' : 'company',
      totals: { leads: totalLeads, newToday, hot: hotLeads, closed: closedLeads, lost: lostLeads, inProgress: inProgressLeads },
      messages: { today: messagesToday, thisWeek: messagesThisWeek },
      avgResponseMinutes: avgMinutes,
      slaTargetMinutes: slaTarget,
      slaCompliance,
      csatAvg,
      csatResponses: csatCount,
      leadsByStatus: leadsByStatus.map((s) => ({ status: s.status, count: s._count.status })),
      leadsThisWeek,
      // Leaderboard enriched with each agent's first-response avg + SLA compliance %.
      agents: agentLeads.map((a) => {
        const r = a.assignedTo ? respByAgent.get(a.assignedTo) : undefined;
        const sample = r ? Number(r.sample) : 0;
        const c = a.assignedTo ? csatMap.get(a.assignedTo) : undefined;
        return {
          name: a.assignedTo!,
          leads: a._count.id,
          avgResponseMinutes: r && r.avg_minutes != null ? Math.round(Number(r.avg_minutes)) : null,
          slaCompliance: sample > 0 ? Math.round((Number(r!.within_sla) / sample) * 100) : null,
          csatAvg: c ? Math.round(Number(c.avg_score) * 10) / 10 : null,
        };
      }),
      projects: projectsData.map((p) => ({ id: p.id, name: p.name, color: p.color, leads: p._count.leads })),
    });
  } catch (error) {
    console.error('GET /analytics/overview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
