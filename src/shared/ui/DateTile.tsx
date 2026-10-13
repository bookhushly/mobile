import { View } from 'react-native';

import { borderWidth, color, radius } from '@/shared/theme';

import { Text } from './Text';

export type DateTileParts = { month: string; day: string; weekday: string };

type Props = {
  /** null: the date isn't known yet ("TBC"). */
  tile: DateTileParts | null;
  testID?: string;
};

const TILE = 56;

// The leading month / day / weekday tile of the gate's event rows and the customer's bookings.
// Decorative for screen readers: the row's label carries the date. Fixed size, so its three
// lines don't scale with Dynamic Type (the row's own text does). The month is ink, not violet:
// the tile isn't an action.
export function DateTile({ tile, testID }: Props) {
  return (
    <View
      testID={testID}
      style={{
        width: TILE,
        height: TILE,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.r3,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: color.surface,
      }}
    >
      {tile === null ? (
        <Text variant="labelSm" tone="textSecondary" maxScale={1}>
          TBC
        </Text>
      ) : (
        <>
          <Text variant="labelSm" tone="textPrimary" maxScale={1}>
            {tile.month}
          </Text>
          <Text variant="title" maxScale={1}>
            {tile.day}
          </Text>
          <Text variant="caption" tone="textSecondary" maxScale={1}>
            {tile.weekday}
          </Text>
        </>
      )}
    </View>
  );
}
