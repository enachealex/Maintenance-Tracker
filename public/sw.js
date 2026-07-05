/* Maintenance Tracker service worker.
 * Handles: notification taps, offline background reminders (Periodic Background
 * Sync, Android/Chrome), and server-sent Web Push (used once the optional
 * backend is added). The app writes a small "due" snapshot into the Cache API
 * so this worker can build reminder text with no network access. */

const SNAPSHOT_CACHE = 'mt-data';
const SNAPSHOT_URL = '/snapshot.json';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Focus the app (or open it) when a reminder is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if ('focus' in w) return w.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })(),
  );
});

// Offline background reminder (Android/Chrome installed PWA).
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'maintenance-check') event.waitUntil(showDueFromSnapshot());
});

// Server-sent Web Push (active once the backend is configured).
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {}
  const title = payload.title || '🔧 Maintenance reminder';
  const body = payload.body || 'Open Maintenance Tracker to review what your vehicles need.';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.tag || 'maintenance',
      renotify: true,
      data: payload.data || {},
    }),
  );
});

async function showDueFromSnapshot() {
  try {
    const cache = await caches.open(SNAPSHOT_CACHE);
    const res = await cache.match(SNAPSHOT_URL);
    if (!res) return;
    const snap = await res.json();
    const due = (snap.vehicles || []).filter((v) => v.due > 0);
    if (due.length === 0) return;
    const total = due.reduce((sum, v) => sum + v.due, 0);
    await self.registration.showNotification(
      `🔧 ${total} maintenance item${total > 1 ? 's' : ''} due`,
      {
        body: due.map((v) => `${v.name}: ${v.due} due`).join(' · '),
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'maintenance-bg',
        renotify: true,
      },
    );
  } catch (_) {
    /* offline / no snapshot yet — nothing to show */
  }
}
