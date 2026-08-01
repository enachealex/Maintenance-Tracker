import { Platform, Share } from 'react-native';
import { AppData } from './types';

/**
 * Backup & restore. All app state is one JSON object, so a backup is just
 * that object pretty-printed. Web downloads a .json file; native opens the
 * share sheet. Import (web only — native has no file picker without an extra
 * dependency) reads a user-picked file; parsing/validation is
 * storage.parseBackup so old-shape backups migrate like stored data does.
 */

const isWeb = Platform.OS === 'web';

export const BACKUP_IMPORT_SUPPORTED = isWeb && typeof document !== 'undefined';

export async function exportBackup(data: AppData): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  if (isWeb) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-tracker-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke later — revoking synchronously can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } else {
    await Share.share({ message: json, title: 'Maintenance Tracker backup' });
  }
}

/** Web only: open the file picker and return the chosen file's text (null = cancelled). */
export function pickBackupFile(): Promise<string | null> {
  if (!BACKUP_IMPORT_SUPPORTED) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
