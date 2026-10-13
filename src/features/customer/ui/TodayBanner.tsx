import { ChevronRight, KeyRound, Ticket } from 'lucide-react-native';
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

// Spec D1: a slim banner at the top of Explore when a booking is happening today — "Your event
// starts at 7:00 pm · Show ticket" — one tap from the door. Not violet-filled: one quiet row.
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
        minHeight: d.rowMin,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        paddingHorizontal: space.s4,
        paddingVertical: space.s3,
        borderRadius: radius.r3,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: pressed ? color.wash : color.surface,
      })}
    >
      <Icon as={today.action === 'tickets' ? Ticket : KeyRound} size="sm" tone="textPrimary" />
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
          {`${today.text} · ${title}`}
        </Text>
        <Text variant="label" tone="linkText" numberOfLines={1}>
          {action}
        </Text>
      </View>
      <Icon as={ChevronRight} size="sm" tone="textSecondary" />
    </Pressable>
  );
}
