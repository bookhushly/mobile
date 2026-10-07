import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const ACTIVITY_FILE = 'bookhushly-scan-activity.csv';

// The only file touching expo-file-system / expo-sharing. The share target may still be reading
// the file after shareAsync resolves (it resolves on share or cancel alike), so the previous
// export is removed at the start of the next one, and at sign-out wipe, rather than straight away.
export async function shareCsv(fileName: string, text: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export scan activity',
    UTI: 'public.comma-separated-values-text',
  });
}

/** Best effort: called from the sign-out wipe; never throws. */
export function deleteSharedCsv(fileName: string): void {
  try {
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
  } catch {
    // Cache files are cleared by the OS eventually; the wipe must not fail over this.
  }
}
