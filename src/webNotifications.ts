import { Platform } from 'react-native';
import { AppData } from './types';
import { dueCount, vehicleName } from './logic';

/**
 * Web/PWA notifications. Everything here is on-device and offline:
 *  - permission prompt (must be triggered by a user gesture),
 *  - a "due" snapshot stored in the Cache API for the service worker,
 *  - Periodic Background Sync registration so an installed Android PWA can
 *    remind the user while the app is closed — no server required.
 * The service worker also accepts server-sent Web Push for the optional backend.
 */

const isWeb = Platform.OS === 'web';

function canNotify(): boolean {
  return (
    isWeb &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

export const WEB_NOTIFICATIONS_SUPPORTED = canNotify();

export type PermState = 'unsupported' | 'default' | 'granted' | 'denied';

export function getPermission(): PermState {
  if (!canNotify()) return 'unsupported';
  return Notification.permission as PermState;
}

let registration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canNotify()) return null;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch {
    return null;
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return registration;
  if (!canNotify()) return null;
  registration =
    (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  return registration;
}

/** Request permission. Must be called from a user gesture (tap). */
export async function requestPermission(): Promise<PermState> {
  if (!canNotify()) return 'unsupported';
  await registerServiceWorker();
  try {
    return (await Notification.requestPermission()) as PermState;
  } catch {
    return getPermission();
  }
}

function buildSnapshot(data: AppData) {
  return {
    vehicles: data.vehicles
      .map((v) => ({ name: vehicleName(v), due: dueCount(v) }))
      .filter((v) => v.due > 0),
    savedAt: Date.now(),
  };
}

/** Persist the due snapshot where the service worker can read it (SWs have no localStorage). */
async function writeSnapshot(data: AppData): Promise<void> {
  try {
    const cache = await caches.open('mt-data');
    await cache.put(
      '/snapshot.json',
      new Response(JSON.stringify(buildSnapshot(data)), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch {
    /* Cache API unavailable */
  }
}

async function ensureBackgroundSync(reg: ServiceWorkerRegistration): Promise<void> {
  try {
    if (!('periodicSync' in reg)) return; // Android/Chrome only
    const status = await (navigator as any).permissions
      ?.query({ name: 'periodic-background-sync' })
      .catch(() => null);
    if (status && status.state !== 'granted') return;
    await (reg as any).periodicSync.register('maintenance-check', {
      minInterval: 12 * 60 * 60 * 1000, // 12h; the browser picks the real cadence
    });
  } catch {
    /* not supported / not an installed PWA — on-open reminders still work */
  }
}

async function showNotification(reg: ServiceWorkerRegistration | null, title: string, body: string) {
  try {
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'maintenance-summary',
        renotify: true,
      } as NotificationOptions);
    } else {
      new Notification(title, { body }); // desktop fallback
    }
  } catch {
    /* mobile browsers require the SW path; ignore if it fails */
  }
}

/**
 * Keep the background snapshot fresh and background sync registered. Pass
 * `confirm: true` right after the user enables reminders to fire a one-off
 * confirmation notification (we otherwise stay quiet while the app is open —
 * the in-app badges already show what's due).
 */
export async function syncWebReminders(
  data: AppData,
  { confirm = false }: { confirm?: boolean } = {},
): Promise<void> {
  if (getPermission() !== 'granted') return;
  const reg = await getRegistration();
  await writeSnapshot(data);
  if (reg) await ensureBackgroundSync(reg);

  if (!confirm) return;
  const due = data.vehicles.filter((v) => dueCount(v) > 0);
  const total = due.reduce((sum, v) => sum + dueCount(v), 0);
  if (total === 0) {
    await showNotification(reg, '✅ Reminders on', "You're all caught up — we'll let you know when something's due.");
  } else {
    await showNotification(
      reg,
      `🔔 Reminders on — ${total} item${total > 1 ? 's' : ''} due`,
      due.map((v) => `${vehicleName(v)}: ${dueCount(v)} due`).join(' · '),
    );
  }
}
