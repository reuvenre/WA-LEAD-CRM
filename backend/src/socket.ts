import { Server as SocketIOServer, Socket } from 'socket.io';

// Module-level reference to the live Socket.io server, so code running OUTSIDE an
// Express request (job handlers, schedulers) can emit realtime events. Set once at
// startup by server.ts. Route handlers keep using `req.app.get('io')` as before.
let ioRef: SocketIOServer | null = null;
export function setIo(io: SocketIOServer) { ioRef = io; }
export function getIo(): SocketIOServer | null { return ioRef; }

export function initSocket(io: SocketIOServer) {
  setIo(io);
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // NOTE: all realtime events are emitted to the per-tenant room (io.to(tenantId)),
    // which is joined after JWT verification in server.ts. We deliberately do NOT expose
    // an unauthenticated `join:lead` room here — it would let any socket subscribe to an
    // arbitrary lead id with no tenant check.

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

// Event names used across the app
export const SOCKET_EVENTS = {
  NEW_MESSAGE: 'message:new',
  MESSAGE_STATUS: 'message:status',
  LEAD_UPDATED: 'lead:updated',
  LEAD_CREATED: 'lead:created',
} as const;

// Per-agent room. Managers sit in the plain `tenantId` room and see everything;
// agents sit ONLY in their personal room so realtime events for other agents'
// conversations never reach them.
export const agentRoom = (tenantId: string, username: string) => `${tenantId}::agent::${username}`;

// Emit a lead-scoped event to exactly the users allowed to see it: all managers
// (tenant room) plus the assigned agent (if any). Unassigned leads → managers only.
export function emitScoped(
  io: SocketIOServer,
  tenantId: string,
  assignedTo: string | null | undefined,
  event: string,
  payload: unknown,
) {
  io.to(tenantId).emit(event, payload);
  if (assignedTo) io.to(agentRoom(tenantId, assignedTo)).emit(event, payload);
}
