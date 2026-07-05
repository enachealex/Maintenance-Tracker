/**
 * Web Push backend (Cloudflare Worker in ../push-worker).
 * The public VAPID key is safe to ship; the private key lives only as a
 * Cloudflare secret. Leave PUSH_SERVER_URL empty to disable server push
 * (on-device background sync still works on Android).
 */
export const PUSH_SERVER_URL = 'https://maintenance-push.enachealex1.workers.dev';
export const VAPID_PUBLIC_KEY =
  'BJNHEZlKQGOtnb89u5D-FskKeqRumQmodbsR1Zn2pqRBYJRivwkm9wJe1Z5m8kBLCYpzgIN7FwAEyoyYxoK6cs4';
