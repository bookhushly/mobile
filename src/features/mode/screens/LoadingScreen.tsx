import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Screen, Spinner, Text } from '@/shared/ui';

// Shown between the splash hiding (2 s cap in the root layout) and the route resolving.
export function LoadingScreen() {
  return (
    <Screen>
      <Text variant="titleLg" accessibilityRole="header">
        Bookhushly
      </Text>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s3 }}>
        <Spinner tone="textSecondary" label="Loading" />
        <Text variant="bodySm" tone="textSecondary" accessibilityLiveRegion="polite">
          Loading your account…
        </Text>
      </View>
    </Screen>
  );
}
