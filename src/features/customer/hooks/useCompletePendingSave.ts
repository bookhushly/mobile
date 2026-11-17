import { useEffect } from 'react';

import { useSaved, type Saved } from '@/features/customer/hooks/useSaved';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';

// Finishes the save a signed-out heart asked for. `userId` stays '' until this is known to be a
// customer. Cleared before writing, so a re-render can't write twice. No screen's heart made this
// write, so no screen's banner hears about a failure: the caller shows the returned `writeError`.
export function useCompletePendingSave(userId: string): Saved {
  const saved = useSaved(userId);
  const { toggle, isSaved } = saved;
  const pending = useSignInPrompt((s) => s.pendingSave);
  const clearPending = useSignInPrompt((s) => s.clearPending);
  useEffect(() => {
    if (userId === '' || pending === null) return;
    clearPending();
    // toggle flips, and the heart was tapped to save: an item already on the account stays.
    if (!isSaved(pending.kind, pending.listingId)) void toggle(pending);
  }, [userId, pending, clearPending, toggle, isSaved]);
  return saved;
}
