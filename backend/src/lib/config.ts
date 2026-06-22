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
