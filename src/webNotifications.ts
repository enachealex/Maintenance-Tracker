import { Platform } from 'react-native';
import { AppData } from './types';
import { dueCount, vehicleName } from './logic';
import { cadenceDays, maintenanceCadenceDays } from './cadence';
import { PUSH_SERVER_URL, VAPID_PUBLIC_KEY } from './pushConfig';

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

/**
 * Ask the browser to protect this origin's storage from eviction. Every
 * vehicle and its service history lives only on-device, so eviction under
 * storage pressure would silently wipe the user's data. Browsers are far more
 * likely to grant this once notification permission is granted or the PWA is
 * installed; safe to call repeatedly.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (!isWeb || typeof navigator === 'undefined') return;
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* unsupported */
  }
}

/** Request permission. Must be called from a user gesture (tap). */
export async function requestPermission(): Promise<PermState> {
  if (!canNotify()) return 'unsupported';
  await registerServiceWorker();
  try {
    const result = (await Notification.requestPermission()) as PermState;
    if (result === 'granted') await requestPersistentStorage();
    return result;
  } catch {
    return getPermission();
  }
}

/**
 * Everything the service worker needs to decide, at event time, whether to
 * show a "maintenance due" reminder, a "update your mileage" prompt, or both.
 * All vehicles are included (a vehicle with nothing due can still have a
 * stale odometer reading).
 */
function buildSnapshot(data: AppData) {
  return {
    vehicles: data.vehicles.map((v) => ({
      id: v.id,
      name: vehicleName(v),
      due: dueCount(v),
      mileageUpdatedAt: v.mileageUpdatedAt,
      cadenceDays: cadenceDays(v),
      maintenanceCadenceDays: maintenanceCadenceDays(v),
    })),
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Subscribe to Web Push and register the subscription with the backend so the
 * server can wake this device on a schedule (mainly for iOS / exact timing;
 * Android also gets on-device background sync). The push carries no data — the
 * service worker renders reminders from the on-device snapshot.
 */
async function subscribeToPush(reg: ServiceWorkerRegistration): Promise<void> {
  if (!PUSH_SERVER_URL || !VAPID_PUBLIC_KEY) return;
  if (!('pushManager' in reg)) return;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    await fetch(`${PUSH_SERVER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
  } catch {
    /* push unsupported or offline — background sync still covers Android */
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
  if (reg) {
    await ensureBackgroundSync(reg); // Android offline background reminders
    await subscribeToPush(reg); // server push (all platforms)
  }

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

export interface WebTap {
  vehicleId: string;
  editMileage: boolean;
}

function parseNavUrl(url: string): WebTap | null {
  try {
    const u = new URL(url, 'https://placeholder.local');
    const vehicleId = u.searchParams.get('vehicle');
    if (!vehicleId) return null;
    return { vehicleId, editMileage: u.searchParams.get('editMileage') === '1' };
  } catch {
    return null;
  }
}

/** Deep link when the app is cold-started from a notification tap (?vehicle=…). */
export function getInitialWebNav(): WebTap | null {
  if (!isWeb || typeof window === 'undefined') return null;
  const tap = parseNavUrl(window.location.href);
  if (tap) window.history.replaceState(null, '', '/');
  return tap;
}

/** Deep link when a notification is tapped while the app is already open. */
export function addWebNotificationTapListener(handler: (tap: WebTap) => void): () => void {
  if (!canNotify()) return () => {};
  const onMessage = (event: MessageEvent) => {
    const d = event.data;
    if (d?.type === 'notification-click' && typeof d.url === 'string') {
      const tap = parseNavUrl(d.url);
      if (tap) handler(tap);
    }
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}

/** Fire a reminder right now so the user can confirm notifications work on their device. */
export async function sendTestReminder(data: AppData): Promise<boolean> {
  if (getPermission() !== 'granted') return false;
  const reg = await getRegistration();
  const due = data.vehicles.filter((v) => dueCount(v) > 0);
  const total = due.reduce((sum, v) => sum + dueCount(v), 0);
  if (total > 0) {
    await showNotification(
      reg,
      `🔧 ${total} maintenance item${total > 1 ? 's' : ''} due`,
      due.map((v) => `${vehicleName(v)}: ${dueCount(v)} due`).join(' · '),
    );
  } else {
    await showNotification(reg, '🔔 Test reminder', "This is how reminders will look. You're all caught up right now.");
  }
  return true;
}
