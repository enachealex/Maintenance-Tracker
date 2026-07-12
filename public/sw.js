/* Maintenance Tracker service worker.
 * Handles: offline app-shell caching, notification taps (with deep links),
 * offline background reminders (Periodic Background Sync, Android/Chrome),
 * and server-sent Web Push.
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

/* ---- Offline app shell ----------------------------------------------------
 * The whole app is static files + on-device data, so caching the shell makes
 * it work fully offline (except the add-vehicle pickers, which need the
 * NHTSA/EPA APIs — cross-origin requests are left untouched below):
 *  - navigations: network-first, cached copy when offline;
 *  - /_expo/static/ bundles: cache-first — Expo content-hashes the filenames,
 *    so an entry never changes and a new build gets new URLs;
 *  - icons/manifest: stale-while-revalidate.
 * Assets are cached as they're first fetched (no precache manifest), so
 * offline works from the first revisit onward. Dev-server bundle URLs match
 * none of these patterns, so local development is never served stale code.
 * Bump the version to drop previously cached shells. */
const SHELL_CACHE = 'mt-shell-v1';
const SWR_PATHS = [
  '/favicon.ico',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('mt-shell-') && n !== SHELL_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIs, push worker: network only

  if (req.mode === 'navigate') {
    event.respondWith(shellNetworkFirst(req));
  } else if (url.pathname.startsWith('/_expo/static/') && !url.search) {
    // Exported bundles are content-hashed and query-less; dev-server bundles
    // always carry ?dev=… and must never be cached (stale code while coding).
    event.respondWith(cacheFirst(req));
  } else if (SWR_PATHS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

// Every navigation serves index.html, so all of them share the '/' cache key
// (deep links like /?vehicle=… included).
async function shellNetworkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put('/', res.clone());
    return res;
  } catch (_) {
    const cached = await cache.match('/');
    return (
      cached ||
      new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<body style="background:#0F1420;color:#E7ECF5;font-family:sans-serif;text-align:center;padding-top:30vh">' +
          "<h1>You're offline</h1><p>Connect once to load Maintenance Tracker, and it will work offline after that.</p>",
        { status: 503, headers: { 'Content-Type': 'text/html' } },
      )
    );
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || refresh;
}
/* ---- End offline app shell ---------------------------------------------- */

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
