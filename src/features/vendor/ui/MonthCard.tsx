import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { monthCompare } from '@/features/vendor/domain/today';
import { color, largeTextScale, radius, space, vendorSize } from '@/shared/theme';
import { formatNaira, Icon, Text } from '@/shared/ui';

const CHART_HEIGHT = vendorSize.chartHeight;
const PAD = vendorSize.chartPad;

type Props = {
  /** Cumulative earnings per day, this month and the same days last month. */
  now: number[];
  then: number[];
  daysInMonth: number;
  thisMonth: string;
  lastMonth: string;
};

function points(series: number[], width: number, days: number, max: number): string {
  return series
    .map((v, i) => {
      const x = PAD + (i / Math.max(1, days - 1)) * (width - 2 * PAD);
      const y = PAD + (1 - v / max) * (CHART_HEIGHT - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * This month against the same days last month (design option A, from Stripe's home): the two
 * numbers and the change first, then both as thin lines. Never a filled block.
 */
export function MonthCard({ now, then, daysInMonth, thisMonth, lastMonth }: Props) {
  const [width, setWidth] = useState(0);
  // Large text: the two amounts stack, so a seven-figure month never runs off the card.
  const stacked = useWindowDimensions().fontScale >= largeTextScale;
  const nowTotal = now.at(-1) ?? 0;
  const thenTotal = then.at(-1) ?? 0;
  const cmp = monthCompare(nowTotal, thenTotal);
  const day = now.length;
  const max = Math.max(1, nowTotal, thenTotal);
  const lastX = PAD + ((day - 1) / Math.max(1, daysInMonth - 1)) * (width - 2 * PAD);
  const lastY = (v: number) => PAD + (1 - v / max) * (CHART_HEIGHT - 2 * PAD);
  return (
    <View
      testID="vendor-month"
      style={{
        backgroundColor: color.wash,
        borderRadius: radius.r4,
        padding: space.s5,
        gap: space.s4,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="labelSm">You’ve made</Text>
        {cmp === null ? null : (
          <View
            accessible
            accessibilityLabel={`${cmp.up ? 'Up' : 'Down'} ${String(cmp.change)} percent on last month`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.s1,
              backgroundColor: color.surface,
              borderRadius: radius.rFull,
              paddingVertical: space.s1,
              paddingHorizontal: space.s3,
            }}
          >
            <Icon as={cmp.up ? ArrowUp : ArrowDown} size="xs" />
            <Text variant="labelSm" tabular>{`${String(cmp.change)}%`}</Text>
          </View>
        )}
      </View>
      <View
        style={{
          flexDirection: stacked ? 'column' : 'row',
          justifyContent: 'space-between',
          gap: space.s4,
        }}
      >
        <View style={{ gap: space.s1, flexShrink: 1 }}>
          <Text variant="title" tabular numberOfLines={1}>
            {formatNaira(nowTotal)}
          </Text>
          <Text variant="labelSm">{thisMonth}</Text>
        </View>
        <View
          style={{ gap: space.s1, flexShrink: 1, alignItems: stacked ? 'flex-start' : 'flex-end' }}
        >
          <Text variant="title" tone="textMuted" tabular numberOfLines={1}>
            {formatNaira(thenTotal)}
          </Text>
          <Text variant="caption" tone="textSecondary">
            {lastMonth}
          </Text>
        </View>
      </View>
      <View
        accessible
        accessibilityLabel={`Day by day, this month against last month`}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
        }}
        style={{ height: CHART_HEIGHT }}
      >
        {width === 0 ? null : (
          <Svg width={width} height={CHART_HEIGHT}>
            <Line
              x1={PAD}
              y1={CHART_HEIGHT - PAD}
              x2={width - PAD}
              y2={CHART_HEIGHT - PAD}
              stroke={color.border}
              strokeWidth={vendorSize.chartLine / 2}
            />
            <Polyline
              points={points(then, width, daysInMonth, max)}
              fill="none"
              stroke={color.borderStrong}
              strokeWidth={vendorSize.chartLine}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Polyline
              points={points(now, width, daysInMonth, max)}
              fill="none"
              stroke={color.textPrimary}
              strokeWidth={vendorSize.chartLineStrong}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Circle
              cx={lastX}
              cy={lastY(thenTotal)}
              r={vendorSize.chartDot}
              fill={color.borderStrong}
            />
            <Circle
              cx={lastX}
              cy={lastY(nowTotal)}
              r={vendorSize.chartDotStrong}
              fill={color.textPrimary}
              stroke={color.surface}
              strokeWidth={2}
            />
          </Svg>
        )}
      </View>
    </View>
  );
}
