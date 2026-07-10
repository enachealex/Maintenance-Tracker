/* Maintenance Tracker service worker.
 * Handles: notification taps (with deep links), offline background reminders
 * (Periodic Background Sync, Android/Chrome), and server-sent Web Push.
 *
 * The app writes a snapshot into the Cache API with, per vehicle: the due
 * item count, when the odometer was last updated, and the user's two chosen
 * reminder frequencies. Background wake-ups arrive on the BROWSER'S schedule
 * (roughly daily), so this worker also persists when it last showed each
 * reminder and only re-shows once the vehicle's chosen frequency has elapsed:
 *  - stale odometer → "Update your mileage" (per vehicle, deep-links into the
 *    odometer editor), at most once per mileage frequency
 *  - items due      → "maintenance due" (per vehicle, deep-links to the car),
 *    at most once per maintenance frequency
 * No vehicle data ever rides in a push message — everything renders from the
 * on-device snapshot. */

const SNAPSHOT_CACHE = 'mt-data';
const SNAPSHOT_URL = '/snapshot.json';
const STATE_URL = '/notify-state.json';
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

// Offline background check (Android/Chrome installed PWA). Quiet unless a
// reminder's frequency has elapsed.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'maintenance-check') event.waitUntil(checkAndNotify(false));
});

// Server-sent Web Push. Web Push requires a visible notification, so when
// every reminder is inside its frequency window we show a neutral note
// instead of spamming (or "all caught up" when truly nothing needs doing).
self.addEventListener('push', (event) => {
  event.waitUntil(checkAndNotify(true));
});

async function readJson(url, fallback) {
  try {
    const cache = await caches.open(SNAPSHOT_CACHE);
    const res = await cache.match(url);
    return res ? await res.json() : fallback;
  } catch (_) {
    return fallback;
  }
}

async function writeState(state) {
  try {
    const cache = await caches.open(SNAPSHOT_CACHE);
    await cache.put(
      STATE_URL,
      new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } }),
    );
  } catch (_) {}
}

function isMileageStale(v, now) {
  if (!v.mileageUpdatedAt || !(v.cadenceDays > 0)) return false;
  return now - Date.parse(v.mileageUpdatedAt) >= v.cadenceDays * DAY_MS;
}

async function checkAndNotify(alwaysShow) {
  const base = { icon: '/favicon.ico', badge: '/favicon.ico', renotify: true };
  const snap = await readJson(SNAPSHOT_URL, { vehicles: [] });
  const vehicles = snap.vehicles || [];
  const state = await readJson(STATE_URL, {});
  const lastMileage = state.mileage || {};
  const lastMaint = state.maint || {};
  const now = Date.now();
  let shown = 0;

  for (const v of vehicles) {
    // 1. Mileage-update prompt: reading is stale AND we haven't prompted
    //    within the vehicle's mileage frequency.
    if (isMileageStale(v, now) && now - (lastMileage[v.id] || 0) >= v.cadenceDays * DAY_MS) {
      const days = Math.max(1, Math.floor((now - Date.parse(v.mileageUpdatedAt)) / DAY_MS));
      await self.registration.showNotification('🧭 Update your mileage', {
        ...base,
        tag: 'mileage-' + v.id,
        body:
          `It's been ${days} day${days === 1 ? '' : 's'} since you updated the odometer on your ` +
          `${v.name}. Tap to enter the current mileage.`,
        data: { url: '/?vehicle=' + encodeURIComponent(v.id) + '&editMileage=1' },
      });
      lastMileage[v.id] = now;
      shown++;
    }

    // 2. Maintenance reminder: items due AND the vehicle's maintenance
    //    frequency has elapsed since we last reminded.
    const maintDays = v.maintenanceCadenceDays > 0 ? v.maintenanceCadenceDays : 7;
    if (v.due > 0 && now - (lastMaint[v.id] || 0) >= maintDays * DAY_MS) {
      await self.registration.showNotification(
        `🔧 ${v.due} maintenance item${v.due > 1 ? 's' : ''} due`,
        {
          ...base,
          tag: 'maintenance-' + v.id,
          body: `Your ${v.name} has ${v.due} item${v.due > 1 ? 's' : ''} that need attention. Tap to see the checklist.`,
          data: { url: '/?vehicle=' + encodeURIComponent(v.id) },
        },
      );
      lastMaint[v.id] = now;
      shown++;
    }
  }

  // Persist when we showed what, pruned to vehicles that still exist.
  const ids = new Set(vehicles.map((v) => v.id));
  const prune = (m) => Object.fromEntries(Object.entries(m).filter(([id]) => ids.has(id)));
  await writeState({ mileage: prune(lastMileage), maint: prune(lastMaint) });

  if (shown === 0 && alwaysShow) {
    const anythingPending = vehicles.some((v) => v.due > 0 || isMileageStale(v, now));
    await self.registration.showNotification(
      anythingPending ? '🔕 Maintenance Tracker' : '✅ Maintenance check',
      {
        ...base,
        tag: 'maintenance-quiet',
        body: anythingPending
          ? 'Reminders are paced to your frequency settings — open the app to see what needs attention.'
          : "You're all caught up — nothing due right now.",
        data: { url: '/' },
      },
    );
  }
}
