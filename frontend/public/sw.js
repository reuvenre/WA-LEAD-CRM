// Service worker for Real Estate Lead CRM: web-push notifications only.
// Deliberately NO offline caching — a stale cached shell breaking a Vercel deploy is
// worse than having no offline mode. The empty fetch handler exists only so browsers
// treat the app as installable.

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  var title = data.title || 'הודעה חדשה';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      tag: data.leadId ? 'lead-' + data.leadId : undefined,
      renotify: !!data.leadId,
      data: { leadId: data.leadId || null }
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

// Passthrough — no caching. Present so the PWA is considered installable.
self.addEventListener('fetch', function () {});
