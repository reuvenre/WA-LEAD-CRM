// API key issuance and authentication for external systems (Make, Zapier, a
// customer's own backend).
//
// The key is shown once at creation and never stored — only its SHA-256. Two
// consequences worth stating plainly: a database leak yields nothing replayable, and
// "show me that key again" is impossible by design. You rotate instead.
//
// SHA-256 rather than bcrypt is deliberate here, and the opposite of the right call
// for passwords: an API key is 256 bits of CSPRNG output, so there is no dictionary to
// attack and no reason to pay a slow hash on every single API request. What matters is
// that the digest is unique-indexed, so authentication is one lookup rather than a
// scan-and-compare against every key in the table.

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma';
import { entitlementsFor, trialStatusOf } from './entitlements';
import { subscriptionLocked } from './billing';

const PREFIX = 'relc_';
const PREFIX_SHOWN = 12; // `relc_` + 7 chars — enough to match a key at a glance

export interface IssuedKey {
  /** Plaintext. Returned exactly once, to the creating admin. */
  key: string;
  id: string;
  prefix: string;
}

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Mint key material. Pure — separated from persistence so it can be tested directly. */
export function newKeyMaterial(): { key: string; keyHash: string; prefix: string } {
  const key = PREFIX + crypto.randomBytes(32).toString('base64url');
  return { key, keyHash: hashKey(key), prefix: key.slice(0, PREFIX_SHOWN) };
}

export async function issueApiKey(tenantId: string, name: string, createdBy?: string): Promise<IssuedKey> {
  const { key, keyHash, prefix } = newKeyMaterial();
  const row = await prisma.apiKey.create({
    data: {
      tenantId,
      name: name.trim().slice(0, 60) || 'מפתח API',
      keyHash,
      prefix,
      createdBy: createdBy ?? null,
    },
    select: { id: true, prefix: true },
  });
  return { key, id: row.id, prefix: row.prefix };
}

// lastUsedAt is useful ("is this integration still live?") but not worth a write on
// every request. Only refresh it once the stored value is this stale.
const LAST_USED_REFRESH_MS = 5 * 60_000;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireApiKey — the tenant the presented key belongs to. */
      apiTenantId?: string;
    }
  }
}

function presentedKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const alt = req.headers['x-api-key'];
  if (typeof alt === 'string' && alt.trim()) return alt.trim();
  return null;
}

/**
 * Authenticate an external caller. Deliberately returns the same generic 401 for a
 * missing, malformed, unknown and revoked key — telling a caller *which* of those
 * applies helps nobody but someone probing for valid keys.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = presentedKey(req);
  if (!key || !key.startsWith(PREFIX)) {
    return res.status(401).json({ error: 'Missing or invalid API key. Send it as `Authorization: Bearer <key>`.' });
  }

  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hashKey(key) },
    select: { id: true, tenantId: true, revokedAt: true, lastUsedAt: true },
  });
  if (!row || row.revokedAt) {
    return res.status(401).json({ error: 'Missing or invalid API key.' });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: row.tenantId },
    select: { plan: true, active: true, trialEndsAt: true, canceledAt: true, subStatus: true, currentPeriodEnd: true },
  });
  if (!tenant || !tenant.active) return res.status(401).json({ error: 'Missing or invalid API key.' });

  // The API is a paid feature, and a key must not outlive the plan that bought it.
  if (!entitlementsFor(tenant.plan).features.apiAccess) {
    return res.status(403).json({ error: 'API access is not included in this plan.', upgrade: true, feature: 'apiAccess' });
  }
  // A lapsed account is read-only everywhere else; the API must not be the back door
  // that keeps working after the customer stopped paying.
  if (tenant.canceledAt || trialStatusOf(tenant).expired || subscriptionLocked(tenant)) {
    return res.status(402).json({ error: 'This account is read-only. Renew the subscription to resume API writes.', upgrade: true });
  }

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_REFRESH_MS) {
    // Fire-and-forget: usage bookkeeping must never fail a caller's request.
    void prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => { /* ignore */ });
  }

  req.apiTenantId = row.tenantId;
  return next();
}
