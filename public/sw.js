/* Maintenance Tracker service worker.
 * Handles: notification taps (with deep links), offline background reminders
 * (Periodic Background Sync, Android/Chrome), and server-sent Web Push.
 * The app writes a snapshot into the Cache API with, per vehicle: the due
 * item count, when the odometer was last updated, and the user's chosen
 * mileage-update cadence. At event time this worker decides what to show:
 *  - stale odometer  → "Update your mileage" prompt (per vehicle, deep-links
 *    straight into that vehicle's odometer editor)
 *  - items due       → maintenance summary
 * No vehicle data ever rides in a push message — everything renders from the
 * on-device snapshot. */

const SNAPSHOT_CACHE = 'mt-data';
const SNAPSHOT_URL = '/snapshot.json';
const DAY_MS = 86400000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Open/focus the app on tap, honoring the notification's deep link.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if ('focus' in w) {
          await w.focus();
          w.postMessage({ type: 'notification-click', url });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});

// Offline background check (Android/Chrome installed PWA). Quiet when nothing needs attention.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'maintenance-check') event.waitUntil(checkAndNotify(false));
});

// Server-sent Web Push. Web Push requires a visible notification, so when
// nothing needs attention we show a low-key "all caught up" instead.
self.addEventListener('push', (event) => {
  event.waitUntil(checkAndNotify(true));
});

async function readSnapshot() {
  try {
    const cache = await caches.open(SNAPSHOT_CACHE);
    const res = await cache.match(SNAPSHOT_URL);
    if (!res) return [];
    const snap = await res.json();
    return snap.vehicles || [];
  } catch (_) {
    return [];
  }
}

function isMileageStale(v, now) {
  if (!v.mileageUpdatedAt || !(v.cadenceDays > 0)) return false;
  return now - Date.parse(v.mileageUpdatedAt) >= v.cadenceDays * DAY_MS;
}

async function checkAndNotify(alwaysShow) {
  const base = { icon: '/favicon.ico', badge: '/favicon.ico', renotify: true };
  const vehicles = await readSnapshot();
  const now = Date.now();
  let shown = 0;

  // 1. Mileage-update prompts — one per vehicle whose reading is stale.
  for (const v of vehicles) {
    if (!isMileageStale(v, now)) continue;
    const days = Math.max(1, Math.floor((now - Date.parse(v.mileageUpdatedAt)) / DAY_MS));
    await self.registration.showNotification('🧭 Update your mileage', {
      ...base,
      tag: 'mileage-' + v.id,
      body:
        `It's been ${days} day${days === 1 ? '' : 's'} since you updated the odometer on your ` +
        `${v.name}. Tap to enter the current mileage.`,
      data: { url: '/?vehicle=' + encodeURIComponent(v.id) + '&editMileage=1' },
    });
    shown++;
  }

  // 2. Maintenance summary — what's due across the garage.
  const due = vehicles.filter((v) => v.due > 0);
  if (due.length > 0) {
    const total = due.reduce((sum, v) => sum + v.due, 0);
    await self.registration.showNotification(
      `🔧 ${total} maintenance item${total > 1 ? 's' : ''} due`,
      {
        ...base,
        tag: 'maintenance-bg',
        body: due.map((v) => `${v.name}: ${v.due} due`).join(' · '),
        data: { url: '/' },
      },
    );
    shown++;
  }

  if (shown === 0 && alwaysShow) {
    await self.registration.showNotification('✅ Maintenance check', {
      ...base,
      tag: 'maintenance-bg',
      body: "You're all caught up — nothing due right now.",
      data: { url: '/' },
    });
  }
}
