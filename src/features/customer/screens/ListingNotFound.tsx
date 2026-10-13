import { ArrowLeft, SearchX } from 'lucide-react-native';

import { EmptyState, Header, IconButton, Screen } from '@/shared/ui';

export const NOT_AVAILABLE = 'This listing isn’t available right now';

// D4: not found, hidden by RLS (e.g. a suspended vendor) or a malformed link: one calm line.
export function ListingNotFound({ onBack }: { onBack: () => void }) {
  return (
    <Screen
      header={
        <Header
          title="Listing"
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
    >
      <EmptyState
        icon={SearchX}
        title={NOT_AVAILABLE}
        action={{ label: 'Go back', onPress: onBack }}
        testID="listing-not-found"
      />
    </Screen>
  );
}
