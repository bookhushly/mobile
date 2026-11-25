import { Image } from 'expo-image';

import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';

// Delivery proof photos can show a doorstep or a person: on a shared phone they must not outlive
// the account that saw them. expo-image keeps them in its disk cache, so a sign-out clears it
// (listing photos simply load again). Registered when the tracking screen's module loads, which is
// before any proof photo can be shown.
registerAlwaysWipe(async () => {
  await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
});
