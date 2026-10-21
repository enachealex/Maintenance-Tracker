/**
 * Pixel access for wheel auto-detection — native implementation.
 *
 * There is no synchronous pixel API on native without extra dependencies,
 * and the auto-detect feature is sugar, not structure: returning null just
 * means the user places the circle with the two taps they already have.
 */

import { ImageDataLike } from '../../core/fitment';

export interface PixelRead extends ImageDataLike {
  /** The source image's natural dimensions, for mapping back. */
  naturalWidth: number;
  naturalHeight: number;
}

export async function readImagePixels(
  _uri: string,
  _maxEdge: number,
): Promise<PixelRead | null> {
  return null;
}
