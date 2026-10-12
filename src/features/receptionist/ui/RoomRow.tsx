import type { RoomRow as Room } from '@/features/receptionist/schemas/desk';
import { RoomStatusMark } from '@/features/receptionist/ui/RoomStatusMark';
import {
  cleanedToday,
  roomPlace,
  roomTitle,
  statusLabel,
} from '@/features/receptionist/ui/roomTone';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { ListRow, Text } from '@/shared/ui';

type Props = { room: Room; today: IsoDate; onPress: (room: Room) => void; testID?: string };

// Phone rooms board row (spec §3 Rooms): number, type · floor, status, cleaned today.
export function RoomRow({ room, today, onPress, testID }: Props) {
  const place = roomPlace(room);
  const cleaned = cleanedToday(room, today);
  const title = roomTitle(room);
  return (
    <ListRow
      testID={testID}
      title={title}
      subtitle={place === '' ? undefined : place}
      note={
        cleaned === null ? undefined : (
          <Text variant="bodySm" tone="textSecondary" tabular>
            {cleaned}
          </Text>
        )
      }
      trailing={<RoomStatusMark status={room.status} />}
      accessibilityLabel={[title, place, statusLabel(room.status), cleaned]
        .filter((s): s is string => s !== null && s !== '')
        .join(', ')}
      onPress={() => {
        onPress(room);
      }}
    />
  );
}
