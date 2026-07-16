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
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { assignmentMode: true, plan: true },
  });
  if (!tenant || tenant.assignmentMode !== 'round_robin') return null;
  // A downgrade may leave the mode set — honour the plan gate at fire time.
  if (!entitlementsFor(tenant.plan).features.roundRobin) return null;

  // Stable ordering so the pointer maps to a consistent agent across calls.
  const agents = await prisma.user.findMany({
    where: { tenantId, role: 'AGENT', active: true },
    select: { username: true },
    orderBy: { createdAt: 'asc' },
  });
  if (agents.length === 0) return null;

  // Advance-and-read in ONE statement. The previous read-then-update transaction ran
  // at Read Committed without a row lock, so two concurrent inbound leads could read
  // the same pointer → same agent twice + a skipped agent. The atomic increment gives
  // every caller a distinct value. (Bounded so it never overflows int.)
  const rows = await prisma.$queryRaw<Array<{ assignmentPointer: number }>>`
    UPDATE "Tenant"
    SET "assignmentPointer" = ("assignmentPointer" + 1) % 1000000
    WHERE id = ${tenantId}
    RETURNING "assignmentPointer"
  `;
  if (rows.length === 0) return null;
  // RETURNING gives the post-increment value; the slot we own is the one before it.
  const slot = (rows[0].assignmentPointer + 1_000_000 - 1) % 1_000_000;
  return agents[slot % agents.length].username;
}
