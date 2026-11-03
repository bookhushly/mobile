import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompletePendingSave } from '@/features/customer/hooks/useCompletePendingSave';
import { useSavedNotices } from '@/features/customer/hooks/useSavedNotices';
import { SavedBanner } from '@/features/customer/ui/SavedBanner';
import { space } from '@/shared/theme';

type Props = { userId: string; onSignInAgain: () => void };

// The sheet promised this save, so a failure has to reach the person whichever screen they're on.
// Its own component: useSaved re-renders on every heart, and the whole stack shouldn't.
export function PendingSaveNotice({ userId, onSignInAgain }: Props) {
  const saved = useCompletePendingSave(userId);
  useSavedNotices(saved);
  const { top } = useSafeAreaInsets();
  if (saved.writeError === null) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: top + space.s3,
        left: space.s4,
        right: space.s4,
      }}
    >
      <SavedBanner
        saved={saved}
        onSignInAgain={onSignInAgain}
        onDismissError={saved.clearWriteError}
      />
    </View>
  );
}
