'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message, Lead } from '@/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export type SocketEventHandlers = {
  onNewMessage?: (message: Message) => void;
  onLeadUpdated?: (lead: Lead) => void;
  onLeadCreated?: (lead: Lead) => void;
};

export function useSocket(handlers: SocketEventHandlers, activeLeadId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);

  // Track the auth token reactively so a re-login (new tenant) rebuilds the socket
  // instead of leaving us in the previous tenant's room.
  const [token, setToken] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null
  );

  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Re-sync the token if it changes (other tabs, logout/login) so the effect below reconnects.
  useEffect(() => {
    const sync = () => setToken(localStorage.getItem('crm_token'));
    window.addEventListener('storage', sync);
    sync();
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    // Send JWT so server places us in the correct tenant room
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: token ? { token } : {},
    });

    socketRef.current = socket;

    socket.on('connect', () => console.log('🔌 Socket connected:', socket.id));
    socket.on('message:new', (message: Message) => handlersRef.current.onNewMessage?.(message));
    socket.on('lead:updated', (lead: Lead) => handlersRef.current.onLeadUpdated?.(lead));
    socket.on('lead:created', (lead: Lead) => handlersRef.current.onLeadCreated?.(lead));
    socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
    socket.on('connect_error', (err) => console.warn('⚠️ Socket connect error:', err.message));

    return () => { socket.disconnect(); };
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (activeLeadId) socket.emit('join:lead', activeLeadId);
    return () => { if (activeLeadId) socket.emit('leave:lead', activeLeadId); };
  }, [activeLeadId]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}
