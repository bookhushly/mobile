import type { Saved } from '@/features/customer/hooks/useSaved';
import { Banner } from '@/shared/ui';

type Props = {
  saved: Saved;
  onSignInAgain: () => void;
  /** Shown while the saved list can't load (hearts wait meanwhile); omitted → no note. */
  loadErrorMessage?: string;
};

/** Whether SavedBanner has anything to show (a screen keeps its footer area only then). */
export function savedBannerShown(saved: Saved, loadErrorMessage?: string): boolean {
  return (
    saved.writeError !== null ||
    saved.lastRemoved !== null ||
    (saved.error && loadErrorMessage !== undefined)
  );
}

// The hearts' outcome under a list (spec §5): a stale session, a transient failure, Undo after an
// unsave, or why the hearts are off. Nothing otherwise. `useSavedNotices` times the Undo and
// transient banners out.
export function SavedBanner({ saved, onSignInAgain, loadErrorMessage }: Props) {
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
  if (saved.error && loadErrorMessage !== undefined)
    return <Banner tone="neutral" message={loadErrorMessage} testID="saved-load-error" />;
  return null;
}
