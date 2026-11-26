import { View } from 'react-native';

import { borderWidth, color, radius, space, vendorSize } from '@/shared/theme';
import { Text } from '@/shared/ui';

const MARK = vendorSize.routeMark;

type Props = { from: string; to: string | null };

/**
 * Pick-up ring → drop-off square joined by one continuous line (design v11, as Uber and Bolt draw
 * it): the marks and the line share one column that spans both addresses. Work in one place
 * (to = null) shows the place alone.
 */
export function Route({ from, to }: Props) {
  return (
    <View
      accessible
      accessibilityLabel={to === null ? from : `From ${from} to ${to}`}
      style={{ flexDirection: 'row', gap: space.s4 }}
    >
      <View style={{ width: MARK, alignItems: 'center', paddingVertical: space.s2 }}>
        <View
          style={{
            width: MARK,
            height: MARK,
            borderRadius: radius.rFull,
            borderWidth: borderWidth.thick,
            borderColor: color.textPrimary,
          }}
        />
        {to === null ? null : (
          <>
            <View
              style={{ width: vendorSize.routeLine, flex: 1, backgroundColor: color.borderStrong }}
            />
            <View
              style={{
                width: MARK,
                height: MARK,
                borderRadius: radius.r1,
                backgroundColor: color.textPrimary,
              }}
            />
          </>
        )}
      </View>
      <View style={{ flex: 1, gap: space.s5 }}>
        <Text variant="bodySm">{from}</Text>
        {to === null ? null : <Text variant="bodySm">{to}</Text>}
      </View>
    </View>
  );
}
