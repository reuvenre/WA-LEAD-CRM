import { Server as SocketIOServer, Socket } from 'socket.io';

export function initSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join a lead-specific room for targeted updates
    socket.on('join:lead', (leadId: string) => {
      socket.join(`lead:${leadId}`);
      console.log(`   Socket ${socket.id} joined room lead:${leadId}`);
    });

    socket.on('leave:lead', (leadId: string) => {
      socket.leave(`lead:${leadId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

// Event names used across the app
export const SOCKET_EVENTS = {
  NEW_MESSAGE: 'message:new',
  LEAD_UPDATED: 'lead:updated',
  LEAD_CREATED: 'lead:created',
} as const;
