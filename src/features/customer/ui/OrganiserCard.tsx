import { View } from 'react-native';

import { initials } from '@/features/customer/ui/initials';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Text, useDensity } from '@/shared/ui';

/**
 * "Organised by", near the end of an event page as Eventbrite and Luma place it (Mobbin,
 * 2026-11-15): the organiser's initials in a circle (a named exception to the no-disc icon rule),
 * their name, and what they are. No follow or message buttons: there is nothing behind them yet.
 */
export function OrganiserCard({ name }: { name: string }) {
  const d = useDensity();
  const size = d.minTarget + space.s4;
  return (
    <View
      testID="organiser"
      accessible
      accessibilityLabel={`Organised by ${name}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        padding: space.s5,
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.rFull,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color.inverse,
        }}
      >
        <Text variant="bodyStrong" tone="onInverse" maxScale={1.2}>
          {initials(name, name)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodyStrong">{name}</Text>
        <Text variant="bodySm" tone="textSecondary">
          Organiser
        </Text>
      </View>
    </View>
  );
}
