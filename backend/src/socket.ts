import { Server as SocketIOServer, Socket } from 'socket.io';

export function initSocket(io: SocketIOServer) {
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
