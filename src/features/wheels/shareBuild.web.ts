import { compositeLayersFor, parseTireSize } from '../../core/fitment';
import { resolvePhotoUri } from '../../core/photoStore';
import { VehiclePhoto } from '../../core/types';

/**
 * Share the composite as an image — web implementation.
 *
 * The preview's layer recipe is redrawn onto a canvas at full image
 * resolution, so the shared picture is sharper than the on-screen preview.
 * Canvas re-encoding also strips EXIF (GPS included) by construction — the
 * plan's requirement to scrub metadata at the share boundary comes free.
 *
 * Web Share API where available (mobile browsers), download fallback
 * elsewhere. Nothing is uploaded anywhere by us either way — decision 9.
 */
export async function shareBuild(
  photo: VehiclePhoto,
  proposedSize: string,
  _viewRef?: unknown,
): Promise<'shared' | 'downloaded' | 'failed'> {
  try {
    const fitted = parseTireSize(photo.fittedTireSize);
    const proposed = parseTireSize(proposedSize);
    const uri = await resolvePhotoUri(photo.uri);
    if (!fitted || !proposed || !uri) return 'failed';

    const img = await loadImage(uri);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    // Calibration is stored against the original image; the stored copy may
    // be a downscaled version of it, so rescale to what we actually have.
    const k = photo.calibration.imageWidth > 0 ? W / photo.calibration.imageWidth : 1;
    const ppi = photo.calibration.pixelsPerInch * k;
    const cx = photo.calibration.centerX * k;
    const cy = photo.calibration.centerY * k;
    const layers = compositeLayersFor(fitted, proposed, ppi);

    const FOOTER = Math.max(48, Math.round(H * 0.08));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H + FOOTER;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'failed';
    ctx.imageSmoothingQuality = 'high';

    const drawScaledInClip = (scale: number, clipRadius: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, clipRadius, 0, Math.PI * 2);
      ctx.clip();
      // Scaling about (cx, cy): the image's top-left maps to center*(1-k).
      ctx.drawImage(img, cx * (1 - scale), cy * (1 - scale), W * scale, H * scale);
      ctx.restore();
    };

    ctx.drawImage(img, 0, 0, W, H);

    ctx.beginPath();
    ctx.arc(cx, cy, layers.coverRadiusPx, 0, Math.PI * 2);
    ctx.fillStyle = '#0B0D12';
    ctx.fill();

    drawScaledInClip(layers.tire.scale, layers.tire.clipRadiusPx);

    if (layers.innerPatch) {
      ctx.beginPath();
      ctx.arc(cx, cy, layers.innerPatch.outerRadiusPx, 0, Math.PI * 2);
      ctx.arc(cx, cy, layers.innerPatch.innerRadiusPx, 0, Math.PI * 2, true);
      ctx.fillStyle = '#15181F';
      ctx.fill('evenodd');
    }

    drawScaledInClip(layers.wheel.scale, layers.wheel.clipRadiusPx);

    // Footer: the one fact the picture is about.
    ctx.fillStyle = '#0F1420';
    ctx.fillRect(0, H, W, FOOTER);
    ctx.fillStyle = '#EDF1F7';
    ctx.font = `600 ${Math.round(FOOTER * 0.42)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${photo.fittedTireSize} → ${proposedSize}`,
      Math.round(W * 0.03),
      H + FOOTER / 2,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) return 'failed';

    const file = new File([blob], `tire-preview-${proposedSize.replace(/[^\w]/g, '-')}.jpg`, {
      type: 'image/jpeg',
    });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: 'Tire size preview' });
        return 'shared';
      } catch {
        // User cancelled or the share failed — fall through to download.
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = uri;
  });
}
