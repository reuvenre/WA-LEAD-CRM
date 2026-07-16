import crypto from 'crypto';
import { prisma } from './prisma';

// ─── Webhook-secret self-heal ──────────────────────────────────────────────────
// webhook.ts now REJECTS payloads for tenants without a webhookSecret (a null
// secret used to mean "accept anything", which let anyone who knew the numeric
// instanceId forge inbound messages, flip opt-outs and poison CSAT). To avoid
// breaking live tenants that predate the secret, every boot sweeps for tenants
// with Green API creds but no secret, mints one, pushes it to Green API via
// setSettings (?token=… on the webhook URL) and only persists it when Green API
// confirmed — so we never enforce a secret Green API isn't actually sending.
export async function ensureWebhookSecrets(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: {
      active: true,
      greenApiInstanceId: { not: null },
      greenApiToken: { not: null },
      webhookSecret: null,
    },
    select: { id: true, name: true, greenApiInstanceId: true, greenApiToken: true, greenApiWebhookUrl: true },
  });
  if (tenants.length === 0) return;

  const publicBase = (process.env.PUBLIC_API_URL || '').trim().replace(/\/+$/, '');

  for (const t of tenants) {
    // Webhook base: the stored URL (query stripped — it may carry a stale token),
    // else derived from PUBLIC_API_URL. Without either we can't tell Green API
    // where to post, so we leave the tenant unsecured-and-now-rejected and log
    // loudly; re-saving Green API settings in the UI fixes it.
    const hookBase = t.greenApiWebhookUrl?.split('?')[0]
      || (publicBase ? `${publicBase}/api/webhook/${t.greenApiInstanceId}` : null);
    if (!hookBase) {
      console.warn(`⚠️ [webhook-secret] tenant "${t.name}": no webhook URL and PUBLIC_API_URL unset — inbound webhooks will be rejected until Green API settings are re-saved`);
      continue;
    }

    const secret = crypto.randomBytes(24).toString('hex');
    const hookUrl = `${hookBase}?token=${secret}`;
    try {
      const r = await fetch(
        `https://api.green-api.com/waInstance${t.greenApiInstanceId}/setSettings/${encodeURIComponent(t.greenApiToken!)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: hookUrl,
            incomingWebhook: 'yes',
            outgoingWebhook: 'yes',            // delivery/read status receipts
            outgoingMessageWebhook: 'yes',     // messages sent from the phone
            outgoingAPIMessageWebhook: 'no',   // sent via our API — already stored
            stateWebhook: 'no',
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (r.ok) {
        await prisma.tenant.update({
          where: { id: t.id },
          data: { webhookSecret: secret, greenApiWebhookUrl: hookUrl },
        });
        console.log(`🔐 [webhook-secret] minted + activated for tenant "${t.name}"`);
      } else {
        console.warn(`⚠️ [webhook-secret] tenant "${t.name}": Green API setSettings HTTP ${r.status} — will retry next boot`);
      }
    } catch (e) {
      console.warn(`⚠️ [webhook-secret] tenant "${t.name}": ${(e as Error).message} — will retry next boot`);
    }
  }
}
