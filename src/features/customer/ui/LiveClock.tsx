import { View } from 'react-native';

import { useServerNow } from '@/features/customer/hooks/useServerNow';
import { lagosClock } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Text } from '@/shared/ui';

// C11 (DICE, Transit): a running clock proves to door staff that this is the live screen, not a
// screenshot. Server time, Lagos wall clock. Screen readers hear "Live ticket" once, never the
// seconds ticking.
export function LiveClock() {
  const now = useServerNow();
  return (
    <View
      testID="live-clock"
      accessible
      accessibilityLabel="Live ticket"
      style={{ alignItems: 'center', gap: space.s1 }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text variant="titleLg" tabular align="center" maxScale={1}>
          {lagosClock(now)}
        </Text>
      </View>
    </View>
  );
}
