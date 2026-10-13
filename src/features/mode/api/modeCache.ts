import { createModeCache } from '@/features/mode/domain/modeCache';
import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';
import { plainKv } from '@/shared/platform/storage';

export const modeCache = createModeCache(plainKv);

// Gone on every sign-out (registered on import; the root layout imports useModeState).
registerAlwaysWipe(() => modeCache.wipe());
