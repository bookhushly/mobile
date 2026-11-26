import { router } from 'expo-router';
import { ArrowLeft, Map } from 'lucide-react-native';

import { EmptyState, Header, IconButton, Screen } from '@/shared/ui';

/** Trips are saved to an account: signed out, say so and offer sign-in. */
export function SignedOutTrips({ onBack }: { onBack: () => void }) {
  return (
    <Screen
      header={
        <Header
          title="Your trips"
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
    >
      <EmptyState
        icon={Map}
        title="Sign in to plan a trip"
        message="Your trips are saved to your account, so you can see what’s booked and what’s still to do."
        action={{
          label: 'Sign in',
          onPress: () => {
            router.push('/sign-in');
          },
        }}
      />
    </Screen>
  );
}
