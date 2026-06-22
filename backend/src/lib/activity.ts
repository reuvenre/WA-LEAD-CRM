import { prisma } from './prisma';

export async function logActivity(
  leadId: string,
  tenantId: string,
  action: string,
  details?: string,
  actor = 'מערכת'
) {
  try {
    await prisma.activity.create({
      data: { leadId, tenantId, action, details, actor },
    });
  } catch {
    // Non-critical — don't throw
  }
}
