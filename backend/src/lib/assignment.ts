// Round-robin lead assignment: rotate brand-new inbound leads across active agents.
//
// Only fires for NEW leads on tenants with assignmentMode='round_robin'. The pointer
// advances in the same transaction that reads it, so concurrent inbound messages
// can't hand two leads to the same agent (or skip one).

import { prisma } from './prisma';
import { entitlementsFor } from './entitlements';

/**
 * Pick the next agent (username) for a new lead, advancing the tenant's round-robin
 * pointer atomically. Returns null if the tenant isn't in round_robin mode or has no
 * active agents (→ lead stays unassigned = managers-only, as before).
 */
export async function pickRoundRobinAssignee(tenantId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { assignmentMode: true, assignmentPointer: true, plan: true },
    });
    if (!tenant || tenant.assignmentMode !== 'round_robin') return null;
    // A downgrade may leave the mode set — honour the plan gate at fire time.
    if (!entitlementsFor(tenant.plan).features.roundRobin) return null;

    // Stable ordering so the pointer maps to a consistent agent across calls.
    const agents = await tx.user.findMany({
      where: { tenantId, role: 'AGENT', active: true },
      select: { username: true },
      orderBy: { createdAt: 'asc' },
    });
    if (agents.length === 0) return null;

    const idx = tenant.assignmentPointer % agents.length;
    const chosen = agents[idx].username;

    // Advance (bounded so it never overflows int over years of leads).
    await tx.tenant.update({
      where: { id: tenantId },
      data: { assignmentPointer: (tenant.assignmentPointer + 1) % 1_000_000 },
    });

    return chosen;
  });
}
