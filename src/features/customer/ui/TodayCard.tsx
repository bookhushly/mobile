import { Image } from 'expo-image';
import { View } from 'react-native';

import { kindWord, type MyBooking } from '@/features/customer/domain/myBookings';
import { chipTone } from '@/features/customer/ui/chipTone';
import type { MainAction } from '@/features/customer/ui/mainAction';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Button, StatusPill, Text } from '@/shared/ui';

type Props = {
  booking: MyBooking;
  action: MainAction;
  onOpen: (b: MyBooking) => void;
  onShowTickets: (b: MyBooking) => void;
  onShowCheckInCode: (b: MyBooking) => void;
  /** Only the first Today card carries the screen's one primary action; later ones are secondary. */
  primary: boolean;
};

const LABEL: Record<MainAction, string> = {
  tickets: 'Show tickets',
  checkInCode: 'Show check-in code',
  open: 'View booking',
};

// C3: something happening today leads the list, with the one action that matters at the door.
export function TodayCard({
  booking: b,
  action,
  onOpen,
  onShowTickets,
  onShowCheckInCode,
  primary,
}: Props) {
  const title = b.title ?? kindWord(b.kind);
  const run = () => {
    if (action === 'tickets') onShowTickets(b);
    else if (action === 'checkInCode') onShowCheckInCode(b);
    else onOpen(b);
  };
  // Airbnb and Expedia Trips (Mobbin, 2026-11-15): the place's photo leads the card with a "Today"
  // pill on it, then the name, what's next and the one action that matters at the door.
  return (
    <View
      style={{
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        overflow: 'hidden',
        backgroundColor: color.surface,
      }}
    >
      {b.imageUrl !== null ? (
        <View style={{ aspectRatio: 2, backgroundColor: color.wash }}>
          <Image
            source={{ uri: b.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            recyclingKey={b.id}
            transition={0}
            accessible={false}
          />
          <View
            style={{
              position: 'absolute',
              top: space.s4,
              left: space.s4,
              paddingHorizontal: space.s4,
              paddingVertical: space.s2,
              borderRadius: radius.rFull,
              backgroundColor: color.surface,
            }}
          >
            <Text variant="labelSm">{`Today · ${kindWord(b.kind)}`}</Text>
          </View>
        </View>
      ) : null}
      <View style={{ gap: space.s3, padding: space.s5 }}>
        {b.imageUrl === null ? (
          <Text variant="labelSm" tone="textSecondary">
            {`Today · ${kindWord(b.kind)}`}
          </Text>
        ) : null}
        <Text variant="title" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="body" tone="textSecondary">
          {b.next}
        </Text>
        <StatusPill tone={chipTone(b.tone)} label={b.status} size="sm" />
        <View style={{ gap: space.s4, marginTop: space.s2 }}>
          <Button
            variant={primary && action !== 'open' ? 'primary' : 'secondary'}
            label={LABEL[action]}
            accessibilityLabel={`${LABEL[action]}, ${title}`}
            onPress={run}
          />
          {action !== 'open' ? (
            <Button
              variant="ghost"
              label="Booking details"
              accessibilityLabel={`Booking details, ${title}`}
              onPress={() => {
                onOpen(b);
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
