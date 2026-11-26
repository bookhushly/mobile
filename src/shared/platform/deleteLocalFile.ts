import { File } from 'expo-file-system';

/** Remove a file the app made (a camera photo in the cache); never throws. */
export function deleteLocalFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone, or not ours to remove: nothing to do.
  }
}
