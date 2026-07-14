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

// ─── Read/import shapes (pulling existing WhatsApp data into the CRM) ──────────
// One contact from the connected WhatsApp account, normalized for lead creation.
export interface ImportedContact {
  phone: string; // digits only, international (no '+'), e.g. "972501234567"
  name: string;  // phone-book name → profile name → the phone as a last resort
}

// One historical message, normalized to our Message columns.
export interface ImportedMessage {
  externalId: string | null; // provider message id (idMessage) — used to dedup
  direction: 'inbound' | 'outbound';
  type: 'text' | 'image' | 'document';
  content: string;
  mediaUrl: string | null;
  fileName: string | null;
  timestamp: Date;
}

export interface ContactsResult { success: boolean; contacts?: ImportedContact[]; error?: string }
export interface HistoryResult { success: boolean; messages?: ImportedMessage[]; error?: string }

export interface MessagingProvider {
  sendText(creds: LineCreds, phone: string, text: string): Promise<OutboundResult>;
  sendFile(
    creds: LineCreds, phone: string, file: Buffer, fileName: string, mimeType: string, caption: string,
  ): Promise<OutboundResult>;
  // Point the provider's inbound webhook at `webhookUrl`. Returns whether it succeeded.
  configureWebhook(creds: LineCreds, webhookUrl: string | null): Promise<boolean>;
  // Pull the account's contact list (for bulk lead import). Groups are excluded.
  listContacts(creds: LineCreds): Promise<ContactsResult>;
  // Pull the past messages of one chat (on-demand history load for a lead).
  getChatHistory(creds: LineCreds, phone: string, count: number): Promise<HistoryResult>;
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

  async listContacts(creds) {
    const { greenApiInstanceId: id, greenApiToken: token } = creds;
    if (!id || !token) return { success: false, error: NOT_CONNECTED };
    try {
      const r = await fetch(
        `https://api.green-api.com/waInstance${id}/getContacts/${encodeURIComponent(token)}`,
        { method: 'GET', signal: AbortSignal.timeout(30_000) },
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({})) as { message?: string };
        return { success: false, error: e.message ?? `Green API HTTP ${r.status}` };
      }
      const raw = await r.json() as Array<{ id?: string; name?: string; contactName?: string; type?: string }>;
      const contacts: ImportedContact[] = [];
      for (const c of Array.isArray(raw) ? raw : []) {
        const cid = c.id ?? '';
        // Only 1:1 user chats — skip groups (@g.us) and anything without a user chatId.
        if (!cid.endsWith('@c.us')) continue;
        const phone = cid.replace('@c.us', '').replace(/\D/g, '');
        if (!phone) continue;
        const name = (c.contactName?.trim() || c.name?.trim() || phone);
        contacts.push({ phone, name });
      }
      return { success: true, contacts };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  async getChatHistory(creds, phone, count) {
    const { greenApiInstanceId: id, greenApiToken: token } = creds;
    if (!id || !token) return { success: false, error: NOT_CONNECTED };
    try {
      const r = await fetch(`https://api.green-api.com/waInstance${id}/getChatHistory/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${phone}@c.us`, count }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({})) as { message?: string };
        return { success: false, error: e.message ?? `Green API HTTP ${r.status}` };
      }
      const raw = await r.json() as GreenHistoryItem[];
      const messages: ImportedMessage[] = [];
      for (const m of Array.isArray(raw) ? raw : []) {
        const mapped = mapGreenHistoryItem(m);
        if (mapped) messages.push(mapped);
      }
      return { success: true, messages };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};

// The subset of a getChatHistory item we read. Green API has varied the exact shape
// over time (flat `textMessage`/`downloadUrl` vs. nested `*Data` objects), so we read
// both defensively rather than trust a single layout.
interface GreenHistoryItem {
  type?: string;            // 'incoming' | 'outgoing'
  idMessage?: string;
  timestamp?: number;       // unix seconds
  typeMessage?: string;     // textMessage | extendedTextMessage | imageMessage | documentMessage | ...
  textMessage?: string;
  caption?: string;
  downloadUrl?: string;
  fileName?: string;
  extendedTextMessage?: { text?: string };
  textMessageData?: { textMessage?: string };
  fileMessageData?: { downloadUrl?: string; caption?: string; fileName?: string };
  extendedTextMessageData?: { text?: string };
}

function mapGreenHistoryItem(m: GreenHistoryItem): ImportedMessage | null {
  const direction: 'inbound' | 'outbound' = m.type === 'outgoing' ? 'outbound' : 'inbound';
  const externalId = m.idMessage ? String(m.idMessage) : null;
  const timestamp = m.timestamp ? new Date(m.timestamp * 1000) : new Date();

  const tm = m.typeMessage;
  let type: 'text' | 'image' | 'document' = 'text';
  let content = '';
  let mediaUrl: string | null = null;
  let fileName: string | null = null;

  if (tm === 'imageMessage') {
    type = 'image';
    mediaUrl = m.downloadUrl ?? m.fileMessageData?.downloadUrl ?? null;
    content = m.caption ?? m.fileMessageData?.caption ?? '';
    fileName = m.fileName ?? m.fileMessageData?.fileName ?? null;
  } else if (tm === 'documentMessage') {
    type = 'document';
    mediaUrl = m.downloadUrl ?? m.fileMessageData?.downloadUrl ?? null;
    content = m.caption ?? m.fileMessageData?.caption ?? '';
    fileName = m.fileName ?? m.fileMessageData?.fileName ?? null;
  } else if (tm === 'textMessage' || tm === 'extendedTextMessage' || tm === undefined) {
    content = m.textMessage
      ?? m.textMessageData?.textMessage
      ?? m.extendedTextMessage?.text
      ?? m.extendedTextMessageData?.text
      ?? '';
  } else {
    // Unsupported kinds (audio, video, location, contact, ...) — skip rather than
    // store an empty bubble the chat can't render.
    return null;
  }

  // A text message with no text, or a media message with no downloadable file, carries
  // nothing to show — drop it.
  if (!content && !mediaUrl) return null;
  return { externalId, direction, type, content, mediaUrl, fileName, timestamp };
}

// ─── Meta Cloud API (Phase 3 — not yet implemented) ──────────────────────────
const metaProvider: MessagingProvider = {
  async sendText() { return { success: false, error: 'Meta provider not implemented yet' }; },
  async sendFile() { return { success: false, error: 'Meta provider not implemented yet' }; },
  async configureWebhook() { return false; },
  // Meta's Cloud API doesn't expose a contact list or historical chat backfill, so
  // import isn't available on Meta lines — surface a clear message instead of failing opaquely.
  async listContacts() { return { success: false, error: 'ייבוא אנשי קשר אינו נתמך בספק Meta' }; },
  async getChatHistory() { return { success: false, error: 'טעינת היסטוריה אינה נתמכת בספק Meta' }; },
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
