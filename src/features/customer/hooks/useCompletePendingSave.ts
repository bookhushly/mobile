import { useEffect } from 'react';

import { useSaved } from '@/features/customer/hooks/useSaved';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';

// Finishes the save a signed-out heart asked for. `userId` stays '' until this is known to be a
// customer. Cleared before writing, so a re-render can't write twice. A failed write shows as an
// empty heart, like any other failed save.
export function useCompletePendingSave(userId: string): void {
  const { toggle, isSaved } = useSaved(userId);
  const pending = useSignInPrompt((s) => s.pendingSave);
  const clearPending = useSignInPrompt((s) => s.clearPending);
  useEffect(() => {
    if (userId === '' || pending === null) return;
    clearPending();
    // toggle flips, and the heart was tapped to save: an item already on the account stays.
    if (!isSaved(pending.kind, pending.listingId)) void toggle(pending);
  }, [userId, pending, clearPending, toggle, isSaved]);
}
