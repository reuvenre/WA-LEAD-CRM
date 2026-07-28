// In-memory sliding-window rate limiting (single instance — same assumption the job
// runner documents). Extracted from routes/widget.ts so every public endpoint shares
// one implementation instead of each re-deriving it.
//
// ⚠️ What this is NOT: a security boundary. `trust proxy: true` means req.ip comes from
// the leftmost X-Forwarded-For entry, which the client controls, so a determined caller
// rotates it freely. It is an anti-abuse speed bump for honest traffic and accidents.
// Anything that must actually be safe has to be safe on its own terms — the billing
// webhook, for instance, re-queries the provider rather than trusting what it was sent.

const hits = new Map<string, number[]>();
const MAX_KEYS = 5_000;

/**
 * Record a hit and report whether the caller is over `max` within `windowMs`.
 * Keys should always include the caller's IP: any identifier the client chooses
 * (visitorId, email) is bypassed by simply picking a new one.
 */
export function rateLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);

  // Evict keys whose entire window has aged out. The timestamps are the eviction
  // signal — a key that embeds the current window index instead would never match
  // its own eviction test and the map would grow forever.
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return recent.length > max;
}

/** Test/maintenance helper — drops all counters. */
export function resetRateLimits(): void {
  hits.clear();
}
