/**
 * Pixel access for wheel auto-detection — web implementation.
 *
 * Draws the picked image onto an offscreen canvas at a working resolution
 * and hands back the RGBA bytes plus the image's natural size, so detected
 * coordinates can be mapped into image space.
 */

import { ImageDataLike } from '../../core/fitment';

export interface PixelRead extends ImageDataLike {
  /** The source image's natural dimensions, for mapping back. */
  naturalWidth: number;
  naturalHeight: number;
}

export async function readImagePixels(uri: string, maxEdge: number): Promise<PixelRead | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = uri;
    await img.decode();
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) return null;
    const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height);
    return { width, height, data: data.data, naturalWidth, naturalHeight };
  } catch {
    // Tainted canvas, revoked blob, decode failure — auto-detect just
    // doesn't happen and the manual taps take over.
    return null;
  }
}
