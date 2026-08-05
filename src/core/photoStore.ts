/**
 * Durable storage for vehicle photos — native implementation.
 * (Web builds resolve photoStore.web.ts instead.)
 *
 * The image picker hands back a URI in the app's CACHE directory, which the
 * OS is free to purge — persisting that URI is a photo that quietly vanishes.
 * Photos the user has calibrated get copied into the document directory,
 * which survives cache cleanup and app restarts.
 *
 * Photo BYTES never go into AppData. The record stores only the URI this
 * module returns, so the main store stays small — a multi-megabyte photo
 * inside AppData would eventually blow the storage quota, and a failed save
 * there takes maintenance data down with it.
 */

// Lazy require so the module loads under Jest without native mocks; the
// legacy path is the stable copy/delete API across recent Expo SDKs.
function fs() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-file-system/legacy');
}

const SUBDIR = 'wheel-photos/';

/** Whether a URI is a key this store must resolve (never true on native). */
export function isStoredPhotoUri(_uri: string): boolean {
  return false;
}

/** Copy a freshly picked photo somewhere durable; returns the URI to persist. */
export async function persistVehiclePhoto(vehicleId: string, sourceUri: string): Promise<string> {
  const FileSystem = fs();
  const dir = `${FileSystem.documentDirectory}${SUBDIR}`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const ext = /\.(png|webp)$/i.exec(sourceUri)?.[1]?.toLowerCase() ?? 'jpg';
  // Unique name per save so replacing a photo can't race its own delete.
  const dest = `${dir}${vehicleId}-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

/** file:// URIs render directly; nothing to resolve on native. */
export async function resolvePhotoUri(uri: string): Promise<string | null> {
  return uri;
}

/** Best-effort cleanup of a photo this store owns. */
export async function deleteVehiclePhoto(uri: string): Promise<void> {
  const FileSystem = fs();
  if (!uri.startsWith(`${FileSystem.documentDirectory}${SUBDIR}`)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
