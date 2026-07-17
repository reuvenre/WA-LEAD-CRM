import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Supabase's pooler caps how many client connections a project may hold (session
// mode: pool_size 15, shared by EVERYTHING — this app, migrations, psql, tools).
// Prisma otherwise defaults its pool to num_cpus*2+1, and inside a container
// os.cpus() reports the HOST's core count — so the app quietly grabbed all 15
// slots. Symptoms: "max clients reached in session mode", intermittent 500s under
// concurrency, and a redeploy's new container unable to connect while the old one
// still holds the pool. Cap it explicitly and leave headroom.
const DEFAULT_CONNECTION_LIMIT = '8';
const DEFAULT_POOL_TIMEOUT = '20'; // seconds a query waits for a free connection

function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    // Only fill in what wasn't set explicitly, so the env var stays authoritative.
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || DEFAULT_CONNECTION_LIMIT);
    }
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', DEFAULT_POOL_TIMEOUT);
    }
    return u.toString();
  } catch {
    return raw; // unparseable — hand it to Prisma untouched rather than break boot
  }
}

export const prisma = global.__prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
