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

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique local fc00::/7
  if (h.startsWith('fe80')) return true; // link-local
  if (h.startsWith('::ffff:')) return isPrivateIPv4(h.slice('::ffff:'.length)); // IPv4-mapped
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
  // Literal IPs were already screened above — nothing to resolve.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')) return true;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => !isPrivateAddress(a.address.toLowerCase()));
  } catch {
    return false;
  }
}
