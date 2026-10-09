import type { KeyValue } from '@/shared/lib/kv';

export const RECOVERY_KEY = 'bh.auth.recovery';

// A reset code signs the user in. Until the new password is saved the session must not survive
// a restart (spec decision 4), so a marker records "reset in progress". It is set before verifyOtp
// so the SIGNED_IN event already sees it.
export function createRecovery(kv: KeyValue) {
  return {
    begin: () => kv.set(RECOVERY_KEY, '1'),
    finish: () => kv.delete(RECOVERY_KEY),
    async pending(): Promise<boolean> {
      try {
        return (await kv.get(RECOVERY_KEY)) !== null;
      } catch {
        // Fail safe: an unreadable marker signs the user out rather than keeping a reset session.
        return true;
      }
    },
  };
}
