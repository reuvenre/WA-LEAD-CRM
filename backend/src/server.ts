import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { leadsRouter } from './routes/leads';
import { messagesRouter } from './routes/messages';
import { webhookRouter } from './routes/webhook';
import { templatesRouter } from './routes/templates';
import { analyticsRouter } from './routes/analytics';
import { automationsRouter } from './routes/automations';
import { projectsRouter } from './routes/projects';
import { realestateRouter } from './routes/realestate';
import { authRouter } from './routes/auth';
import { superAdminRouter } from './routes/superAdmin';
import { tenantRouter } from './routes/tenant';
import { googleRouter } from './routes/google';
import { waImportRouter } from './routes/waImport';
import { widgetRouter } from './routes/widget';
import { pushRouter } from './routes/push';
import { campaignsRouter } from './routes/campaigns';
import { WIDGET_JS } from './lib/widgetScript';
import { startJobRunner, stopJobRunner } from './lib/jobs';
import { requireAuth } from './middleware/auth';
import { requireFeature } from './lib/entitlements';
import { initSocket, agentRoom } from './socket';
import type { AuthPayload } from './middleware/auth';
import { JWT_SECRET, validateEnv } from './lib/config';
import { prisma } from './lib/prisma';

validateEnv();

const app = express();
const httpServer = http.createServer(app);

// ─── CORS origin resolution ───────────────────────────────────────────────────
// FRONTEND_URL may hold one or more comma-separated origins. We normalize away
// trailing slashes and also auto-allow any *.vercel.app deployment (production +
// preview URLs), so a brittle exact-match string can't silently block the app.
const normalize = (s: string) => s.trim().replace(/\/+$/, '');
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3002')
  .split(',')
  .map(normalize)
  .filter(Boolean);

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true; // non-browser clients (curl, server-to-server)
  const o = normalize(origin);
  if (allowedOrigins.includes(o)) return true;
  try {
    const host = new URL(o).hostname;
    if (host === 'localhost' || host.endsWith('.vercel.app')) return true;
  } catch { /* malformed origin → reject below */ }
  return false;
}

const corsOrigin: cors.CorsOptions['origin'] = (origin, cb) =>
  isAllowedOrigin(origin) ? cb(null, true) : cb(new Error(`Origin not allowed: ${origin}`));

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// ─── Public website chat widget (BEFORE the restrictive global CORS) ──────────
// Customer sites live on arbitrary origins the CRM allowlist rejects, so the widget
// gets its own permissive CORS + body parser and is registered first so the global
// cors() below never runs for it. The widget.js script itself loads cross-origin
// freely (script src) and is served from the compiled bundle.
app.get('/widget.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.set('Access-Control-Allow-Origin', '*');
  res.send(WIDGET_JS);
});
app.use('/api/widget', cors({ origin: true }), express.json({ limit: '256kb' }), widgetRouter);

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

// Only the file-upload route needs the big body (base64 image/document, ~16MB + 33%).
// Everything else is capped at 1mb so a giant JSON body can't OOM the container.
app.use('/api/messages/send-file', express.json({ limit: '25mb' }));
app.use(express.json({ limit: '1mb' }));

// ─── Public routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/google', googleRouter); // mixes public (callback) + per-route requireAuth

// Liveness: cheap, always-200 as long as the event loop runs.
app.get('/health/live', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
// Readiness: actually touches the DB so a monitor reports "down" during a DB outage
// (the old /health returned 200 even when every real request was 500ing).
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ok', db: 'up', timestamp: new Date().toISOString() });
  } catch {
    return res.status(503).json({ status: 'degraded', db: 'down', timestamp: new Date().toISOString() });
  }
});

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/api/leads', requireAuth, leadsRouter);
app.use('/api/messages', requireAuth, messagesRouter);
app.use('/api/wa-import', requireAuth, waImportRouter);   // pull existing WhatsApp contacts + chat history
app.use('/api/push', requireAuth, pushRouter);            // web-push subscriptions
app.use('/api/templates', requireAuth, templatesRouter);
app.use('/api/analytics', requireAuth, requireFeature('analytics'), analyticsRouter);
app.use('/api/campaigns', requireAuth, requireFeature('broadcast'), campaignsRouter);
app.use('/api/automations', requireAuth, requireFeature('automations'), automationsRouter);
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/realestate', requireAuth, realestateRouter);
app.use('/api/tenant', requireAuth, tenantRouter);          // per-tenant settings
app.use('/api/super-admin', requireAuth, superAdminRouter); // super-admin only

// ─── Socket.io — tenant rooms ─────────────────────────────────────────────────
// Each client joins their tenantId room after connecting
io.on('connection', (socket) => {
  // Client sends JWT in handshake auth
  const token = socket.handshake.auth?.token as string | undefined;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
      if (payload.tenantId && payload.step !== '2fa_pending') {
        const isManager = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN';
        if (isManager) {
          // Managers see the whole tenant.
          socket.join(payload.tenantId);
          console.log(`🔌 Socket joined tenant room: ${payload.tenantId}`);
        } else {
          // Agents only get events for their own conversations.
          socket.join(agentRoom(payload.tenantId, payload.username));
          console.log(`🔌 Socket joined agent room for ${payload.username}`);
        }
      }
    } catch {
      // Invalid token — socket still connects but not in any room
    }
  }
});

initSocket(io);

const PORT = Number(process.env.PORT) || 3001;
// Bind to :: (IPv6, dual-stack — also accepts IPv4). Railway's V2 runtime reaches
// the container over an IPv6 private network, so an IPv4-only bind makes the app
// unreachable from the edge proxy and every request returns 502 even while the
// container is healthy/ONLINE.
httpServer.listen(PORT, '::', () => {
  console.log(`🚀 Server running on port ${PORT} (bound to :: / dual-stack)`);
  console.log(`🔌 Socket.io with tenant rooms enabled`);
  startJobRunner();
});

// ─── Resilience ────────────────────────────────────────────────────────────────
// A stray unhandled rejection would otherwise crash the process silently; log it
// loudly (and keep serving) so one bad promise doesn't take down every tenant.
process.on('unhandledRejection', (reason) => {
  console.error('🔴 Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('🔴 Uncaught exception:', err);
});

// Graceful shutdown on redeploy: stop accepting, drain, release the DB pool.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`⏳ ${signal} received — shutting down gracefully…`);
  stopJobRunner();
  io.close();
  httpServer.close(() => console.log('✅ HTTP server closed'));
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { io };
