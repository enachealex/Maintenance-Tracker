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

// Offline background reminder (Android/Chrome installed PWA). Stay quiet when
// nothing is due.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'maintenance-check') event.waitUntil(showDueFromSnapshot(false));
});

// Server-sent Web Push. The message carries no vehicle data — we read the
// on-device snapshot and render it here, so personal data stays on the device.
// Web Push requires a visible notification, so always show something.
self.addEventListener('push', (event) => {
  event.waitUntil(showDueFromSnapshot(true));
});

async function showDueFromSnapshot(alwaysShow) {
  const opts = (body, tag) => ({
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: tag || 'maintenance-bg',
    renotify: true,
  });
  try {
    const cache = await caches.open(SNAPSHOT_CACHE);
    const res = await cache.match(SNAPSHOT_URL);
    const snap = res ? await res.json() : { vehicles: [] };
    const due = (snap.vehicles || []).filter((v) => v.due > 0);
    if (due.length === 0) {
      if (alwaysShow) {
        await self.registration.showNotification(
          '✅ Maintenance check',
          opts("You're all caught up — nothing due right now."),
        );
      }
      return;
    }
    const total = due.reduce((sum, v) => sum + v.due, 0);
    await self.registration.showNotification(
      `🔧 ${total} maintenance item${total > 1 ? 's' : ''} due`,
      opts(due.map((v) => `${v.name}: ${v.due} due`).join(' · ')),
    );
  } catch (_) {
    if (alwaysShow) {
      await self.registration.showNotification(
        '🔧 Maintenance reminder',
        opts('Open Maintenance Tracker to review your vehicles.'),
      );
    }
  }
}
