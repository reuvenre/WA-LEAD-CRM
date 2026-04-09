'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message, Lead } from '@/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export type SocketEventHandlers = {
  onNewMessage?: (message: Message) => void;
  onLeadUpdated?: (lead: Lead) => void;
  onLeadCreated?: (lead: Lead) => void;
};

export function useSocket(handlers: SocketEventHandlers, activeleadId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);

  // Always up-to-date handlers without re-subscribing
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('message:new', (message: Message) => {
      handlersRef.current.onNewMessage?.(message);
    });

    socket.on('lead:updated', (lead: Lead) => {
      handlersRef.current.onLeadUpdated?.(lead);
    });

    socket.on('lead:created', (lead: Lead) => {
      handlersRef.current.onLeadCreated?.(lead);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️  Socket connect error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Only mount once

  // Join/leave lead room when activeleadId changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (activeleadId) {
      socket.emit('join:lead', activeleadId);
    }

    return () => {
      if (activeleadId) {
        socket.emit('leave:lead', activeleadId);
      }
    };
  }, [activeleadId]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}
