import * as Brightness from 'expo-brightness';
import { Platform } from 'react-native';

type Restore = () => Promise<void>;

const noop: Restore = async () => {};

async function quietly(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Brightness is a nicety for scanning a code; a failure must never surface to the user.
  }
}

// Raises the current screen (never the system setting, which needs a permission) to full
// brightness. Resolves to a function that puts it back; neither ever throws.
// Android: restoreSystemBrightnessAsync hands control back to the system.
// iOS: the change outlives the app, so the value read beforehand is set back explicitly.
export async function raiseBrightness(): Promise<Restore> {
  try {
    if (Platform.OS === 'android') {
      await Brightness.setBrightnessAsync(1);
      return () => quietly(() => Brightness.restoreSystemBrightnessAsync());
    }
    const prev = await Brightness.getBrightnessAsync();
    await Brightness.setBrightnessAsync(1);
    return () => quietly(() => Brightness.setBrightnessAsync(prev));
  } catch {
    return noop;
  }
}
