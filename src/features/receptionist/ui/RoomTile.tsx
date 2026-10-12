import { Pressable } from 'react-native';

import type { RoomRow } from '@/features/receptionist/schemas/desk';
import { RoomStatusMark } from '@/features/receptionist/ui/RoomStatusMark';
import { roomTitle, statusLabel } from '@/features/receptionist/ui/roomTone';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Text } from '@/shared/ui';

export const ROOM_TILE_MIN_WIDTH = 140;

type Props = { room: RoomRow; onPress: (room: RoomRow) => void; testID?: string };

// Tablet rooms board tile: the number large, its type, and the status (dot + word).
export function RoomTile({ room, onPress, testID }: Props) {
  const type = room.hotel_room_types?.name ?? '';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[roomTitle(room), type, statusLabel(room.status)]
        .filter((s) => s !== '')
        .join(', ')}
      onPress={() => {
        onPress(room);
      }}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: ROOM_TILE_MIN_WIDTH,
        gap: space.s2,
        padding: space.s4,
        borderRadius: radius.r3,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: pressed ? color.wash : color.surface,
      })}
    >
      <Text variant="titleLg" tabular numberOfLines={1}>
        {String(room.room_number)}
      </Text>
      <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
        {type === '' ? ' ' : type}
      </Text>
      <RoomStatusMark status={room.status} />
    </Pressable>
  );
}
