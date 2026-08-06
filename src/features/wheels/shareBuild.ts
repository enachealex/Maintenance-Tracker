import { VehiclePhoto } from '../../core/types';

/**
 * Share the composite as an image — native implementation.
 * (Web builds resolve shareBuild.web.ts instead.)
 *
 * Captures the on-screen preview view and hands the file to the OS share
 * sheet. The capture is a fresh render, so no EXIF from the original photo
 * (GPS included) can leak into what gets shared. Nothing is uploaded by us —
 * the share sheet goes wherever the user points it (decision 9).
 *
 * Dependencies are require()d lazily so the module loads under Jest without
 * native mocks.
 */
export async function shareBuild(
  _photo: VehiclePhoto,
  _proposedSize: string,
  viewRef?: unknown,
): Promise<'shared' | 'downloaded' | 'failed'> {
  try {
    if (!viewRef) return 'failed';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { captureRef } = require('react-native-view-shot');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sharing = require('expo-sharing');
    const uri = await captureRef(viewRef, { format: 'jpg', quality: 0.9 });
    if (!(await Sharing.isAvailableAsync())) return 'failed';
    await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
    return 'shared';
  } catch {
    return 'failed';
  }
}
