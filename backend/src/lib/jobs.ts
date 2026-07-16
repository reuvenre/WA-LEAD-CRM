// In-process job runner: polls the Job table and executes deferred work
// (scheduled messages, campaign steps, CSAT surveys, ...).
//
// Deliberately queue-less: the app runs as a single Railway instance (same
// assumption as the in-memory auth limiter), so a DB-backed poller with
// FOR UPDATE SKIP LOCKED is race-safe even if a second instance ever appears.
// Scaling to real replicas later = swap this for an external queue.

import { prisma } from './prisma';

export type JobHandler = (payload: unknown, job: ClaimedJob) => Promise<void>;

export interface ClaimedJob {
  id: string;
  tenantId: string;
  type: string;
  payload: unknown;
  attempts: number;
}

const POLL_INTERVAL_MS = 15_000;
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

const handlers = new Map<string, JobHandler>();
let timer: NodeJS.Timeout | null = null;
let tickRunning = false; // don't overlap ticks if a batch runs long

// Feature modules register their handlers at import time (e.g. 'send_message').
export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

// Enqueue a deferred unit of work. runAt in the past = "as soon as possible".
export async function enqueueJob(tenantId: string, type: string, runAt: Date, payload?: unknown): Promise<string> {
  const job = await prisma.job.create({
    data: { tenantId, type, runAt, payload: payload === undefined ? undefined : (payload as object) },
  });
  return job.id;
}

// Persist an idempotency checkpoint into the job's own payload. A handler that
// stamps e.g. { sent: true } BEFORE a provider call can skip the call when the
// job is retried after a crash — the retry receives the updated payload.
export async function setJobPayload(jobId: string, payload: object): Promise<void> {
  await prisma.job.update({ where: { id: jobId }, data: { payload } });
}

// Drop queued (not yet claimed) jobs of a type whose JSON payload matches. Used to
// cancel a campaign's pending send chain on pause/resume so chains never duplicate.
export async function cancelPendingJobs(tenantId: string, type: string, payloadKey: string, payloadValue: string): Promise<number> {
  const r = await prisma.job.deleteMany({
    where: { tenantId, type, status: 'pending', payload: { path: [payloadKey], equals: payloadValue } },
  });
  return r.count;
}

// Claim a batch atomically: flip pending→running and return the claimed rows.
// SKIP LOCKED makes concurrent claimers (belt-and-suspenders) never double-run a job.
async function claimBatch(): Promise<ClaimedJob[]> {
  return prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "Job" SET status = 'running', attempts = attempts + 1, "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE status = 'pending' AND "runAt" <= now()
      ORDER BY "runAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "tenantId", type, payload, attempts
  `;
}

async function runJob(job: ClaimedJob): Promise<void> {
  const handler = handlers.get(job.type);
  try {
    if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
    await handler(job.payload, job);
    await prisma.job.update({ where: { id: job.id }, data: { status: 'done', lastError: null } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const giveUp = job.attempts >= MAX_ATTEMPTS;
    // Retry with linear backoff (1min per attempt) until MAX_ATTEMPTS, then park as failed.
    await prisma.job.update({
      where: { id: job.id },
      data: giveUp
        ? { status: 'failed', lastError: message }
        : { status: 'pending', lastError: message, runAt: new Date(Date.now() + job.attempts * 60_000) },
    }).catch(() => { /* job row gone (tenant deleted) — nothing to record */ });
    console.warn(`⚠️ Job ${job.id} (${job.type}) attempt ${job.attempts} failed${giveUp ? ' — giving up' : ''}: ${message}`);
  }
}

// Jobs stuck in 'running' (process crashed/killed mid-run) get re-armed once they're
// demonstrably stale. NEVER re-arm fresh 'running' rows: during a Railway redeploy the
// old instance can still be executing them, and an eager re-arm would double-run sends.
const STALE_RUNNING_MS = 10 * 60_000;
async function sweepStaleRunning(): Promise<void> {
  const r = await prisma.job.updateMany({
    where: { status: 'running', updatedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) } },
    data: { status: 'pending' },
  }).catch(() => null);
  if (r && r.count > 0) console.log(`♻️ Re-armed ${r.count} stale interrupted job(s)`);
}

async function tick(): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
  try {
    await sweepStaleRunning();
    // Keep claiming until the due queue is drained (bounded per-batch).
    for (;;) {
      const batch = await claimBatch();
      if (batch.length === 0) break;
      // Jobs within a batch run sequentially — send-type jobs must not burst.
      for (const job of batch) await runJob(job);
      if (batch.length < BATCH_SIZE) break;
    }
  } catch (err) {
    console.error('🔴 Job runner tick failed:', err);
  } finally {
    tickRunning = false;
  }
}

export function startJobRunner(): void {
  if (timer) return;
  // Stale 'running' rows are re-armed inside tick() (sweepStaleRunning) — an
  // unconditional boot-time re-arm raced the still-draining old instance during
  // redeploys and double-ran jobs.
  timer = setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
  timer.unref(); // never keep the process alive just for the poller
  console.log('⏰ Job runner started (poll every 15s)');
}

export function stopJobRunner(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
