'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

// VAPID public key (base64url) → Uint8Array for pushManager.subscribe.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushStatus = 'unsupported' | 'unconfigured' | 'default' | 'granted' | 'denied' | 'ios-a2hs';

/**
 * Web-push subscription management for the current user. Handles SW registration,
 * permission, subscribe/unsubscribe, and iOS's "add to home screen" precondition
 * (Safari only exposes Notification/Push once the PWA is installed, iOS 16.4+).
 */
export function usePush() {
  const [status, setStatus] = useState<PushStatus>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const isStandalone = () =>
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true);
  const isIOS = () => typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      // iOS < 16.4 or a browser without push. On iOS, installing to home screen unlocks it.
      setStatus(isIOS() && !isStandalone() ? 'ios-a2hs' : 'unsupported');
      return;
    }
    try {
      const { enabled } = await api.push.publicKey();
      if (!enabled) { setStatus('unconfigured'); return; }
    } catch { setStatus('unconfigured'); return; }

    if (isIOS() && !isStandalone() && Notification.permission === 'default') { setStatus('ios-a2hs'); return; }

    setStatus(Notification.permission as PushStatus);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setSubscribed(!!sub);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const { key, enabled } = await api.push.publicKey();
      if (!enabled || !key) { setStatus('unconfigured'); return; }

      const perm = await Notification.requestPermission();
      setStatus(perm as PushStatus);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: DOM lib types applicationServerKey as BufferSource; our Uint8Array's
        // ArrayBufferLike backing doesn't line up under strict lib settings.
        applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
      });
      await api.push.subscribe(sub.toJSON() as PushSubscriptionJSON, navigator.userAgent);
      setSubscribed(true);
    } catch (e) {
      console.warn('push enable failed', e);
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await api.push.unsubscribe(sub.endpoint).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, subscribed, busy, enable, disable, refresh };
}
