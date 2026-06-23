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
import { requireAuth } from './middleware/auth';
import { initSocket } from './socket';
import type { AuthPayload } from './middleware/auth';
import { JWT_SECRET } from './lib/config';

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

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json());

// ─── Public routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/google', googleRouter); // mixes public (callback) + per-route requireAuth
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/api/leads', requireAuth, leadsRouter);
app.use('/api/messages', requireAuth, messagesRouter);
app.use('/api/templates', requireAuth, templatesRouter);
app.use('/api/analytics', requireAuth, analyticsRouter);
app.use('/api/automations', requireAuth, automationsRouter);
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
        socket.join(payload.tenantId);
        console.log(`🔌 Socket joined room: ${payload.tenantId}`);
      }
    } catch {
      // Invalid token — socket still connects but not in any room
    }
  }
});

initSocket(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.io with tenant rooms enabled`);
});

export { io };
