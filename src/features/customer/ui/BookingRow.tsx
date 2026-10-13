import { Image } from 'expo-image';
import { View } from 'react-native';

import { kindWord, type MyBooking } from '@/features/customer/domain/myBookings';
import { chipTone } from '@/features/customer/ui/chipTone';
import { dayParts, shortDate } from '@/shared/lib/lagosDay';
import { radius, space } from '@/shared/theme';
import { DateTile, ListRow, StatusPill, Text } from '@/shared/ui';

export const HIDDEN_LINE = "Details aren't available right now";
const THUMB = 56;

type Props = { booking: MyBooking; onPress: (b: MyBooking) => void };

// Spec §3 / Mobbin §1: date tile · title · kind word + what's next · status chip · thumbnail.
export function BookingRow({ booking: b, onPress }: Props) {
  const kind = kindWord(b.kind);
  // C4: a hidden listing still lists, as its kind word, with its dates and status.
  const hidden = b.title === null;
  const title = b.title ?? kind;
  const subtitle = hidden ? b.next : `${kind} · ${b.next}`;
  const spoken = [title, shortDate(b.start), subtitle, hidden ? HIDDEN_LINE : null, b.status]
    .filter((s): s is string => s !== null)
    .join(', ');
  return (
    <ListRow
      onPress={() => {
        onPress(b);
      }}
      leading={<DateTile tile={dayParts(b.start)} />}
      title={title}
      subtitle={subtitle}
      accessibilityLabel={spoken}
      note={
        <View style={{ gap: space.s1, marginTop: space.s1 }}>
          {hidden ? (
            <Text variant="caption" tone="textSecondary">
              {HIDDEN_LINE}
            </Text>
          ) : null}
          <StatusPill tone={chipTone(b.tone)} label={b.status} size="sm" />
        </View>
      }
      trailing={
        b.imageUrl !== null ? (
          <Image
            source={{ uri: b.imageUrl }}
            style={{ width: THUMB, height: THUMB, borderRadius: radius.r2 }}
            contentFit="cover"
            recyclingKey={b.id}
            transition={0}
            accessible={false}
          />
        ) : undefined
      }
    />
  );
}
