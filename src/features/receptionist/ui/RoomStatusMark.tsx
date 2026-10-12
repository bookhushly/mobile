import { View } from 'react-native';

import type { RoomStatus } from '@/features/receptionist/schemas/desk';
import { roomTone, statusLabel, TONE_FG } from '@/features/receptionist/ui/roomTone';
import { color, radius, space } from '@/shared/theme';
import { Text } from '@/shared/ui';

const DOT = 10;

// A dot plus the word: the word carries the status, the dot only reinforces it.
export function RoomStatusMark({ status }: { status: RoomStatus }) {
  const tone = roomTone(status);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
      <View
        style={{
          width: DOT,
          height: DOT,
          borderRadius: radius.rFull,
          backgroundColor: color.status[tone].solid,
        }}
      />
      <Text variant="labelSm" tone={TONE_FG[tone]} numberOfLines={1}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}
