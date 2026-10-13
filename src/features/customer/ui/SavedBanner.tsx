import type { Saved } from '@/features/customer/hooks/useSaved';
import { Banner } from '@/shared/ui';

type Props = { saved: Saved; onSignInAgain: () => void };

// The hearts' outcome under a list (spec §5): a stale session, a transient failure, or Undo after
// an unsave. Nothing otherwise.
export function SavedBanner({ saved, onSignInAgain }: Props) {
  if (saved.writeError === 'stale')
    return (
      <Banner
        tone="neutral"
        message="Couldn’t save. Sign in again if this keeps happening."
        action={{ label: 'Sign in again', onPress: onSignInAgain }}
        testID="saved-stale"
      />
    );
  if (saved.writeError === 'transient')
    return (
      <Banner
        tone="neutral"
        message="Couldn’t save — check your connection and try again."
        testID="saved-transient"
      />
    );
  if (saved.lastRemoved !== null)
    return (
      <Banner
        tone="neutral"
        message={`Removed ${saved.lastRemoved.title ?? 'listing'} from saved.`}
        action={{
          label: 'Undo',
          onPress: () => {
            void saved.undo();
          },
        }}
        testID="saved-undo"
      />
    );
  return null;
}
