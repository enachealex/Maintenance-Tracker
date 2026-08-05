import { useEffect, useState } from 'react';
import { isStoredPhotoUri, resolvePhotoUri } from '../../core/photoStore';

/**
 * Renderable URI for a persisted photo. Store keys (web IndexedDB) resolve
 * asynchronously; everything else — file:, data:, blob:, https: — passes
 * straight through so old records and seeded demo data keep working.
 *
 * Returns null while resolving or when the bytes are gone; callers show a
 * placeholder rather than a broken image.
 */
export function usePhotoUri(uri: string): string | null {
  const [resolved, setResolved] = useState<string | null>(isStoredPhotoUri(uri) ? null : uri);

  useEffect(() => {
    if (!isStoredPhotoUri(uri)) {
      setResolved(uri);
      return;
    }
    let alive = true;
    setResolved(null);
    resolvePhotoUri(uri).then((u) => {
      if (alive) setResolved(u);
    });
    return () => {
      alive = false;
    };
  }, [uri]);

  return resolved;
}
