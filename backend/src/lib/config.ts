// Centralized secrets/config. Fails fast in production if critical secrets are missing.

const FALLBACK_JWT_SECRET = 'change-this-secret';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret === FALLBACK_JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET is not set (or uses the insecure default). Refusing to start in production — ' +
          'set a strong, random JWT_SECRET environment variable.'
      );
    }
    console.warn(
      '⚠️  JWT_SECRET is not set — using an insecure development default. ' +
        'Set JWT_SECRET before deploying to production.'
    );
    return FALLBACK_JWT_SECRET;
  }

  return secret;
}

export const JWT_SECRET = resolveJwtSecret();

// Assert hard requirements at boot, and log which optional integrations are inert so
// the operator isn't surprised by a silently-disabled feature in production.
export function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — refusing to start.');
  }
  const optional: Record<string, string> = {
    'SMTP_USER / SMTP_PASS': process.env.SMTP_USER && process.env.SMTP_PASS ? 'on' : 'off (password-reset emails disabled)',
    'APIFY_API_TOKEN': process.env.APIFY_API_TOKEN ? 'on' : 'off (live listings pull disabled)',
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID ? 'on' : 'off (calendar sync disabled)',
    'SENTRY_DSN': process.env.SENTRY_DSN ? 'on' : 'off (error tracking disabled)',
    'CARDCOM_TERMINAL / CARDCOM_API_NAME': process.env.CARDCOM_TERMINAL && process.env.CARDCOM_API_NAME ? 'on' : 'off (self-serve checkout disabled — upgrades need manual activation)',
  };
  for (const [k, v] of Object.entries(optional)) {
    if (v.startsWith('off')) console.warn(`⚠️  ${k}: ${v}`);
  }
}
