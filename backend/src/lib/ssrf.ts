// Guards against SSRF for user-supplied outbound webhook URLs.
// Two layers: isSafeWebhookUrl (sync, literal-address checks — used at save time for
// fast validation feedback) and isSafeWebhookUrlResolved (async — resolves the host
// via DNS at REQUEST time and re-checks every returned address, so a hostname whose
// A/AAAA record points at a private/metadata IP can't slip through).

import { lookup } from 'dns/promises';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  return false;
}

// Expand an IPv6 literal to its 8 hextets (numbers). Returns null if not valid IPv6.
function expandIPv6(input: string): number[] | null {
  const h = input.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (!h.includes(':')) return null;
  // Split off a trailing dotted-quad (IPv4-mapped/embedded, e.g. ::ffff:127.0.0.1).
  let tail: number[] = [];
  let head = h;
  const dm = h.match(/:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dm) {
    const q = dm[1].split('.').map(Number);
    if (q.some((n) => n > 255)) return null;
    tail = [(q[0] << 8) | q[1], (q[2] << 8) | q[3]];
    head = h.slice(0, h.length - dm[1].length); // keep the trailing ':'
  }
  const parts = head.split('::');
  if (parts.length > 2) return null;
  const toGroups = (s: string) => s ? s.split(':').filter((x) => x !== '').map((x) => parseInt(x, 16)) : [];
  const left = toGroups(parts[0]);
  const right = parts.length === 2 ? toGroups(parts[1]) : [];
  const groups = parts.length === 2
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length - tail.length)).fill(0), ...right, ...tail]
    : [...left, ...tail];
  if (groups.length !== 8 || groups.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return groups;
}

function isPrivateIPv6(host: string): boolean {
  const g = expandIPv6(host);
  if (!g) return false;
  const h0 = g[0];
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1 loopback
  if (g.every((x) => x === 0)) return true;                           // :: unspecified
  if ((h0 & 0xfe00) === 0xfc00) return true;                          // fc00::/7 unique-local
  if ((h0 & 0xffc0) === 0xfe80) return true;                          // fe80::/10 link-local
  // IPv4-mapped ::ffff:0:0/96 and IPv4-compatible — re-check the embedded v4 address,
  // regardless of whether the parser rendered it dotted or as hex hextets.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return isPrivateIPv4(`${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`);
  }
  if (g[0] === 0x64 && g[1] === 0xff9b) { // 64:ff9b::/96 NAT64
    return isPrivateIPv4(`${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`);
  }
  return false;
}

/** Returns true if the URL is safe to fetch from the server (public HTTP/HTTPS endpoint). */
export function isSafeWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (isPrivateIPv4(host)) return false;
  if (isPrivateIPv6(host)) return false;

  return true;
}

function isPrivateAddress(addr: string): boolean {
  return isPrivateIPv4(addr) || isPrivateIPv6(addr);
}

/**
 * Full request-time check: syntactic screen + DNS resolution, rejecting when ANY
 * resolved address is private/loopback/link-local/metadata. DNS failure = unsafe
 * (fail closed). Call this immediately before fetching a user-supplied URL.
 */
export async function isSafeWebhookUrlResolved(raw: string): Promise<boolean> {
  if (!isSafeWebhookUrl(raw)) return false;
  const host = new URL(raw).hostname.replace(/^\[/, '').replace(/\]$/, '');
  // Literal IPs were already fully range-checked by isSafeWebhookUrl (both families,
  // incl. IPv4-mapped IPv6) — nothing left to resolve.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')) return true;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => !isPrivateAddress(a.address.toLowerCase()));
  } catch {
    return false;
  }
}
