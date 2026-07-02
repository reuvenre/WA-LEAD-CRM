import { prisma } from './prisma';
import { isSafeWebhookUrl } from './ssrf';

export type AutomationEvent =
  | 'lead.created'
  | 'lead.status_changed'
  | 'lead.message_received'
  | 'message.sent';

export async function triggerAutomations(
  event: AutomationEvent,
  payload: Record<string, unknown>,
  tenantId: string
) {
  try {
    const webhooks = await prisma.automationWebhook.findMany({
      where: { tenantId, active: true, events: { has: event } },
    });

    for (const webhook of webhooks) {
      if (!isSafeWebhookUrl(webhook.url)) {
        console.warn(`Automation webhook skipped (unsafe URL) (${webhook.name}): ${webhook.url}`);
        continue;
      }
      fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(5000), // a slow endpoint must not tie up sockets
      }).catch((err) => console.warn(`Automation webhook failed (${webhook.name}):`, err));
    }
  } catch {
    // Non-critical
  }
}
