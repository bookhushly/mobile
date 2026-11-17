import { useContext } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { LockScreenPreview } from '@/features/customer/ui/LockScreenPreview';
import { borderWidth, color, layout, space } from '@/shared/theme';
import { Button, Stack, Text, TextLink } from '@/shared/ui';

type Props = { onTurnOn: () => void; onNotNow: () => void };

// Asked once, after the first sign-in, before the system prompt (Viator, IHG, Booking.com, Airbnb
// all do this): the OS asks only once, so its prompt is shown only to someone who said yes here.
// Layout after IHG: the promise at the top, a phone showing what arrives, the two answers below.
export function NotificationPrimerScreen({ onTurnOn, onNotNow }: Props) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.surface,
        paddingTop: insets.top + space.s8,
        paddingBottom: Math.max(insets.bottom, space.s5) + space.s3,
      }}
    >
      <Stack gap="s3" style={{ paddingHorizontal: layout.formGutter }}>
        <Text variant="displaySm" accessibilityRole="header">
          Know before you go
        </Text>
        <Text variant="subtitle" tone="textSecondary">
          Booking confirmations, payment updates and reminders before you go, straight to your
          phone.
        </Text>
      </Stack>
      <View style={{ flex: 1, marginTop: space.s8 }}>
        <LockScreenPreview />
      </View>
      {/* A hairline keeps the cropped phone from running into the buttons. */}
      <View style={{ height: borderWidth.hairline, backgroundColor: color.border }} />
      <Stack gap="s4" style={{ paddingHorizontal: layout.formGutter, paddingTop: space.s6 }}>
        <Button label="Turn on notifications" onPress={onTurnOn} />
        <View style={{ alignItems: 'center' }}>
          <TextLink size="lg" label="Not now" onPress={onNotNow} />
        </View>
      </Stack>
    </View>
  );
}
