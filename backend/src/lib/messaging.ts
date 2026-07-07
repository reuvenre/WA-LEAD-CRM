// Provider-neutral WhatsApp messaging layer.
//
// A "line" (one WhatsApp number) carries a `provider` + its credentials. All the
// rest of the app talks to this interface and never to a specific vendor, so adding
// Meta Cloud API later is a new implementation here — not a rewrite of the routes.

export type LineProviderName = 'GREEN_API' | 'META';

// The minimal credential shape a provider needs. Sourced from a Line row (preferred)
// or, during the rollout, from the Tenant's legacy Green API fields.
export interface LineCreds {
  provider: LineProviderName;
  greenApiInstanceId?: string | null;
  greenApiToken?: string | null;
  metaPhoneNumberId?: string | null;
  metaAccessToken?: string | null;
}

export interface OutboundResult {
  success: boolean;
  messageId?: string;
  urlFile?: string; // hosted media URL (for files), when the provider returns one
  error?: string;
}

export interface MessagingProvider {
  sendText(creds: LineCreds, phone: string, text: string): Promise<OutboundResult>;
  sendFile(
    creds: LineCreds, phone: string, file: Buffer, fileName: string, mimeType: string, caption: string,
  ): Promise<OutboundResult>;
  // Point the provider's inbound webhook at `webhookUrl`. Returns whether it succeeded.
  configureWebhook(creds: LineCreds, webhookUrl: string | null): Promise<boolean>;
}

// ─── Green API ────────────────────────────────────────────────────────────────
// Shown when a tenant tries to send before connecting WhatsApp. NEVER fake-succeed —
// a "sent" checkmark on a message that never left is the worst possible failure.
const NOT_CONNECTED = 'וואטסאפ לא מחובר — חברו את החשבון בהגדרות → Green API';

const greenApiProvider: MessagingProvider = {
  async sendText(creds, phone, text) {
    const { greenApiInstanceId: id, greenApiToken: token } = creds;
    if (!id || !token) return { success: false, error: NOT_CONNECTED };
    try {
      const r = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${phone}@c.us`, message: text }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({})) as { message?: string };
        return { success: false, error: e.message ?? `Green API HTTP ${r.status}` };
      }
      const data = await r.json() as { idMessage?: string };
      return { success: true, messageId: data.idMessage };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async sendFile(creds, phone, file, fileName, mimeType, caption) {
    const { greenApiInstanceId: id, greenApiToken: token } = creds;
    if (!id || !token) return { success: false, error: NOT_CONNECTED };
    try {
      // Media methods live on media.green-api.com (not api.green-api.com).
      const form = new FormData();
      form.append('chatId', `${phone}@c.us`);
      form.append('file', new Blob([file], { type: mimeType }), fileName);
      form.append('fileName', fileName);
      if (caption) form.append('caption', caption);
      const r = await fetch(`https://media.green-api.com/waInstance${id}/sendFileByUpload/${token}`, {
        method: 'POST', body: form,
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({})) as { message?: string };
        return { success: false, error: e.message ?? `Green API HTTP ${r.status}` };
      }
      const data = await r.json() as { idMessage?: string; urlFile?: string };
      return { success: true, messageId: data.idMessage, urlFile: data.urlFile };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async configureWebhook(creds, webhookUrl) {
    const { greenApiInstanceId: id, greenApiToken: token } = creds;
    if (!id || !token) return false;
    try {
      const r = await fetch(`https://api.green-api.com/waInstance${id}/setSettings/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(webhookUrl ? { webhookUrl } : {}),
          incomingWebhook: 'yes',
          outgoingWebhook: 'yes',            // delivery/read receipts
          outgoingMessageWebhook: 'yes',     // phone-sent messages
          outgoingAPIMessageWebhook: 'no',   // API-sent, already stored
          stateWebhook: 'no',
        }),
      });
      if (!r.ok) console.warn(`Green API setSettings HTTP ${r.status}`);
      return r.ok;
    } catch (e) {
      console.warn('Green API setSettings failed:', (e as Error).message);
      return false;
    }
  },
};

// ─── Meta Cloud API (Phase 3 — not yet implemented) ──────────────────────────
const metaProvider: MessagingProvider = {
  async sendText() { return { success: false, error: 'Meta provider not implemented yet' }; },
  async sendFile() { return { success: false, error: 'Meta provider not implemented yet' }; },
  async configureWebhook() { return false; },
};

export function getProvider(provider: LineProviderName): MessagingProvider {
  return provider === 'META' ? metaProvider : greenApiProvider;
}

// Resolve the credentials to use for a conversation: the lead's own line if it has
// one, otherwise the tenant's legacy Green API fields (backward-compat during rollout).
export function resolveCreds(
  line: { provider: LineProviderName; greenApiInstanceId: string | null; greenApiToken: string | null; metaPhoneNumberId: string | null; metaAccessToken: string | null } | null | undefined,
  tenant: { greenApiInstanceId: string | null; greenApiToken: string | null } | null | undefined,
): LineCreds {
  if (line) {
    return {
      provider: line.provider,
      greenApiInstanceId: line.greenApiInstanceId,
      greenApiToken: line.greenApiToken,
      metaPhoneNumberId: line.metaPhoneNumberId,
      metaAccessToken: line.metaAccessToken,
    };
  }
  return {
    provider: 'GREEN_API',
    greenApiInstanceId: tenant?.greenApiInstanceId ?? null,
    greenApiToken: tenant?.greenApiToken ?? null,
  };
}
