// Per-line send pacing — the anti-ban layer for automated senders.
//
// WhatsApp (via Green API) tolerates human-speed sending; a burst of API sends is
// the classic ban trigger. Any automated sender (broadcast campaign, drip step,
// scheduled message, CSAT survey) must go through `paced()` so that messages on
// the same line are BOTH serialized and spaced 3–8 seconds apart. Interactive
// one-off sends from the chat UI stay direct — a human typing is its own pacing.
//
// In-memory per-line state matches the single-instance deployment (same assumption
// as the auth limiter and the job runner).

const MIN_GAP_MS = 3_000;
const MAX_GAP_MS = 8_000;

const lastSendAt = new Map<string, number>();   // lineKey → epoch ms of last send
const chains = new Map<string, Promise<void>>(); // lineKey → tail of the send chain

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const randomGap = () => MIN_GAP_MS + Math.floor(Math.random() * (MAX_GAP_MS - MIN_GAP_MS));

/**
 * Run `fn` (one outbound send) on the given line, serialized after any in-flight
 * sends on that line and delayed so consecutive sends are 3–8s apart.
 *
 * `lineKey`: the Line id, or a tenant-scoped fallback (e.g. `tenant:<id>`) when the
 * lead has no line yet. Errors from `fn` propagate to the caller; the chain itself
 * never breaks (a failed send still stamps the gap — failure and retry look the
 * same to WhatsApp's rate heuristics).
 */
export function paced<T>(lineKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(lineKey) ?? Promise.resolve();

  const run = prev.then(async () => {
    const last = lastSendAt.get(lineKey) ?? 0;
    const wait = Math.max(0, last + randomGap() - Date.now());
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastSendAt.set(lineKey, Date.now());
    }
  });

  // The stored chain must swallow rejections, or one failed send would poison
  // every subsequent send on the line.
  const tail = run.then(() => undefined, () => undefined);
  chains.set(lineKey, tail);
  // Housekeeping: once the chain drains, drop the map entries so memory doesn't
  // grow with the number of lines ever used.
  tail.then(() => {
    if (chains.get(lineKey) === tail) {
      chains.delete(lineKey);
    }
  });

  return run;
}

/** The pacing key for a conversation: its line, or a tenant-wide key pre-lines. */
export function lineKeyFor(lead: { lineId?: string | null; tenantId: string }): string {
  return lead.lineId ?? `tenant:${lead.tenantId}`;
}
