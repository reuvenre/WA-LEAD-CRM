// Scheduled ("send later") messages — a thin job handler over the shared outbound
// sender. Registered at import time (pulled in by routes/messages.ts at startup).

import { registerJobHandler, type ClaimedJob } from './jobs';
import { sendOutboundText } from './outbound';

export interface SendMessagePayload { leadId: string; content: string }

registerJobHandler('send_message', async (payload: unknown, job: ClaimedJob) => {
  const { leadId, content } = (payload ?? {}) as Partial<SendMessagePayload>;
  if (!leadId || !content) return; // malformed — nothing to send, treat as done
  const r = await sendOutboundText(job.tenantId, leadId, content, {});
  // Throw on failure so the job runner retries (e.g. transient provider/network error).
  if (!r.ok) throw new Error(r.error || 'scheduled send failed');
});
