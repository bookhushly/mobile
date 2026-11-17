import { KeyRound, Ticket } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { kindWord } from '@/features/customer/domain/myBookings';
import type { TodayBanner as Today } from '@/features/customer/domain/todayBanner';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  today: Today;
  onShowTickets: (bookingId: string) => void;
  onShowCheckInCode: (bookingId: string) => void;
  testID?: string;
};

const ACTION = { tickets: 'Show ticket', checkInCode: 'Show check-in code' } as const;

// Spec D1, laid out after Booking.com's "Upcoming trip" card (Mobbin, 2026-11-15): the place's name
// on its own line (two lines before it's cut), what happens today under it, and the one action as a
// pill. The whole card is the button, so the pill is drawn, not a second control. Not violet-filled.
export function TodayBanner({ today, onShowTickets, onShowCheckInCode, testID }: Props) {
  const d = useDensity();
  const b = today.booking;
  const title = b.title ?? kindWord(b.kind);
  const action = ACTION[today.action];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Today: ${today.text}, ${title}. ${action}`}
      onPress={() => {
        if (today.action === 'tickets') onShowTickets(b.id);
        else onShowCheckInCode(b.id);
      }}
      style={({ pressed }) => ({
        gap: space.s4,
        padding: space.s5,
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: pressed ? color.wash : color.surface,
      })}
    >
      <View style={{ gap: space.s1 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={2}>
          {today.text}
        </Text>
      </View>
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s3,
          minHeight: d.minTarget,
          paddingHorizontal: space.s5,
          borderRadius: radius.rFull,
          borderWidth: borderWidth.hairline,
          borderColor: color.borderStrong,
        }}
      >
        <Icon as={today.action === 'tickets' ? Ticket : KeyRound} size="sm" />
        <Text variant="label">{action}</Text>
      </View>
    </Pressable>
  );
}
