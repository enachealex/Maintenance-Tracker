/**
 * Durable storage for vehicle photos — web implementation.
 *
 * The web image picker returns a blob: URL, which dies on page reload —
 * mobile browsers reload pages constantly, so a persisted blob URL is a
 * photo that disappears. Bytes go into IndexedDB instead, and the record
 * stores an `idb:` key that resolvePhotoUri turns back into an object URL
 * each session.
 *
 * Photos are downscaled before storing (long edge capped) — a 12-megapixel
 * phone photo rendered four times over at up to 3× scale is exactly the kind
 * of thing that blanks out images on mobile browsers, and full resolution
 * buys nothing at preview sizes.
 *
 * Photo BYTES never go into AppData: localStorage tops out around 5MB, and
 * once a giant record makes saveData throw, maintenance edits silently stop
 * persisting too. IndexedDB has no such squeeze.
 */

const DB_NAME = 'maintenance-tracker-photos';
const STORE = 'photos';
const PREFIX = 'idb:';
const MAX_EDGE_PX = 1600;

export function isStoredPhotoUri(uri: string): boolean {
  return uri.startsWith(PREFIX);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Cap the long edge; return the original blob untouched on any failure. */
async function downscale(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const k = MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height);
    if (k >= 1) return blob;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * k);
    canvas.height = Math.round(bitmap.height * k);
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.87),
    );
    return out ?? blob;
  } catch {
    return blob;
  }
}

/** Session cache of object URLs so repeated renders don't hit IndexedDB. */
const urlCache = new Map<string, string>();

export async function persistVehiclePhoto(vehicleId: string, sourceUri: string): Promise<string> {
  const blob = await (await fetch(sourceUri)).blob();
  const small = await downscale(blob);
  const db = await openDb();
  await idbPut(db, vehicleId, small);
  const key = PREFIX + vehicleId;
  // Overwrote the bytes — drop any object URL still pointing at the old ones.
  const stale = urlCache.get(key);
  if (stale) {
    URL.revokeObjectURL(stale);
    urlCache.delete(key);
  }
  return key;
}

/**
 * Turn a persisted URI into something renderable. Non-store URIs (data:,
 * file:, blob:, https:) pass through untouched, which keeps old records and
 * seeded demo data working. Returns null when the key has no bytes — the
 * caller should treat that photo as gone.
 */
export async function resolvePhotoUri(uri: string): Promise<string | null> {
  if (!isStoredPhotoUri(uri)) return uri;
  const cached = urlCache.get(uri);
  if (cached) return cached;
  try {
    const db = await openDb();
    const blob = await idbGet(db, uri.slice(PREFIX.length));
    if (!blob) return null;
    const objectUrl = URL.createObjectURL(blob);
    urlCache.set(uri, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

export async function deleteVehiclePhoto(uri: string): Promise<void> {
  if (!isStoredPhotoUri(uri)) return;
  try {
    const db = await openDb();
    await idbDelete(db, uri.slice(PREFIX.length));
  } catch {
    /* best-effort */
  }
  const cached = urlCache.get(uri);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(uri);
  }
}
