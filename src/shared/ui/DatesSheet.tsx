import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { MONTHS_LONG, daysBetween, longDate, shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { color, radius, space } from '@/shared/theme';

import { Button } from './Button';
import { useDensity } from './DensityProvider';
import { Sheet } from './Sheet';
import { Text } from './Text';

type Range = { checkIn: IsoDate | null; checkOut: IsoDate | null };

type Props = {
  visible: boolean;
  today: IsoDate;
  months?: number;
  minNights: number;
  initial: Range;
  onDone: (range: { checkIn: IsoDate; checkOut: IsoDate }) => void;
  onClose: () => void;
};

type MonthData = { key: string; title: string; lead: number; days: IsoDate[] };

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const two = (n: number) => String(n).padStart(2, '0');

function buildMonths(today: IsoDate, count: number): MonthData[] {
  const y0 = Number(today.slice(0, 4));
  const m0 = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const first = new Date(Date.UTC(y0, m0 + i, 1));
    const y = first.getUTCFullYear();
    const m = first.getUTCMonth();
    const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return {
      key: `${String(y)}-${two(m + 1)}`,
      title: `${MONTHS_LONG[m] ?? ''} ${String(y)}`,
      lead: (first.getUTCDay() + 6) % 7, // Monday first
      days: Array.from({ length }, (_d, d) => `${String(y)}-${two(m + 1)}-${two(d + 1)}`),
    };
  });
}

function nightsLabel(n: number): string {
  return n === 1 ? '1 night' : `${String(n)} nights`;
}

type MonthProps = {
  month: MonthData;
  today: IsoDate;
  checkIn: IsoDate | null;
  checkOut: IsoDate | null;
  onPick: (d: IsoDate) => void;
};

// memo: a tap changes the range, but months the range doesn't touch receive null/null and skip.
const Month = memo(function Month({ month, today, checkIn, checkOut, onPick }: MonthProps) {
  const cells: (IsoDate | null)[] = [...Array<null>(month.lead).fill(null), ...month.days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return (
    <View style={{ paddingBottom: space.s6 }}>
      <Text variant="headline" accessibilityRole="header" style={{ paddingBottom: space.s3 }}>
        {month.title}
      </Text>
      {rows.map((row) => (
        <View key={row.find((c) => c !== null) ?? 'pad'} style={{ flexDirection: 'row' }}>
          {row.map((d, i) => (
            <View key={d ?? `pad-${String(i)}`} style={{ flex: 1 }}>
              {d === null ? null : (
                <Day day={d} today={today} checkIn={checkIn} checkOut={checkOut} onPick={onPick} />
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

function Day({
  day,
  today,
  checkIn,
  checkOut,
  onPick,
}: {
  day: IsoDate;
  today: IsoDate;
  checkIn: IsoDate | null;
  checkOut: IsoDate | null;
  onPick: (d: IsoDate) => void;
}) {
  const { minTarget } = useDensity();
  const past = day < today;
  const isIn = day === checkIn;
  const isOut = day === checkOut;
  const between = checkIn !== null && checkOut !== null && day > checkIn && day < checkOut;
  const edge = isIn || isOut;
  const suffix = isIn ? ', check-in' : isOut ? ', check-out' : '';
  return (
    <Pressable
      testID={`day-${day}`}
      accessibilityRole="button"
      accessibilityLabel={`${longDate(day)}${suffix}`}
      accessibilityState={{ disabled: past, selected: edge || between }}
      disabled={past}
      onPress={() => {
        onPick(day);
      }}
      style={{
        height: minTarget,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: edge ? color.actionFill : between ? color.selectedWash : 'transparent',
        borderRadius: edge ? radius.r3 : 0,
      }}
    >
      <Text
        variant="body"
        tabular
        tone={edge ? 'onAction' : past ? 'textMuted' : 'textPrimary'}
        align="center"
      >
        {String(Number(day.slice(8, 10)))}
      </Text>
    </Pressable>
  );
}

export function DatesSheet({
  visible,
  today,
  months = 12,
  minNights,
  initial,
  onDone,
  onClose,
}: Props) {
  const [range, setRange] = useState<Range>(initial);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setRange(initial); // reopening starts from what the caller holds
  }
  // Stable list data across renders; rebuilt only when the window changes.
  const data = useMemo(() => buildMonths(today, months), [today, months]);

  // Stable identity so memoised months are not invalidated by a parent render.
  const pick = useCallback((d: IsoDate) => {
    setRange((r) => {
      if (r.checkIn === null || r.checkOut !== null || d <= r.checkIn)
        return { checkIn: d, checkOut: null };
      return { checkIn: r.checkIn, checkOut: d };
    });
  }, []);

  const { checkIn, checkOut } = range;
  const nights = checkIn !== null && checkOut !== null ? daysBetween(checkIn, checkOut) : 0;
  const ready = checkIn !== null && checkOut !== null && nights >= minNights;
  return (
    <Sheet
      visible={visible}
      title="Choose dates"
      onClose={onClose}
      testID="dates-sheet"
      footer={
        <>
          {minNights > 1 ? (
            <Text variant="bodySm" tone="textSecondary" align="center">
              {`At least ${String(minNights)} nights`}
            </Text>
          ) : null}
          <Button
            label={ready ? `Choose · ${nightsLabel(nights)}` : 'Choose'}
            disabled={!ready}
            onPress={() => {
              if (checkIn !== null && checkOut !== null) onDone({ checkIn, checkOut });
            }}
          />
        </>
      }
    >
      <Text variant="bodyStrong" testID="dates-header">
        {`${checkIn === null ? 'Check-in' : shortDate(checkIn)} → ${checkOut === null ? 'Check-out' : shortDate(checkOut)}`}
      </Text>
      <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
        {WEEK.map((w) => (
          <View key={w} style={{ flex: 1 }}>
            <Text variant="caption" tone="textSecondary" align="center">
              {w}
            </Text>
          </View>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={(m) => m.key}
        initialNumToRender={3}
        renderItem={({ item }) => {
          const first = item.days[0] ?? '';
          const last = item.days[item.days.length - 1] ?? '';
          const touches =
            checkIn !== null &&
            checkIn <= last &&
            (checkOut === null ? checkIn >= first : checkOut >= first);
          return (
            <Month
              month={item}
              today={today}
              checkIn={touches ? checkIn : null}
              checkOut={touches ? checkOut : null}
              onPick={pick}
            />
          );
        }}
      />
    </Sheet>
  );
}
