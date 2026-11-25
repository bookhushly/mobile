import { memo, useMemo, type ReactElement } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { MONTHS_LONG, longDate, type IsoDate } from '@/shared/lib/lagosDay';
import { color, radius, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Text } from './Text';

type Props = {
  today: IsoDate;
  months?: number;
  start: IsoDate | null;
  end: IsoDate | null;
  /** Stable identity (a store action or useCallback): months the range doesn't touch skip. */
  onPick: (d: IsoDate) => void;
  /** Spoken after a chosen day: "check-in" / "pick-up". */
  startWord: string;
  endWord: string;
  /** The days between: violet wash (stays) or the neutral grey band (car rentals). */
  band?: 'selected' | 'neutral';
  /**
   * Content that scrolls away above the months (a title, the chosen dates). With it, each month
   * carries its own weekday row, so the whole page scrolls and small phones with large text still
   * see a full month (the fixed weekday row would scroll out with the header otherwise).
   */
  header?: ReactElement;
  testID?: string;
};

function Weekdays() {
  return (
    <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
      {WEEK.map((w) => (
        <View key={w} style={{ flex: 1 }}>
          <Text variant="caption" tone="textSecondary" align="center">
            {w}
          </Text>
        </View>
      ))}
    </View>
  );
}

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

type DayOpts = Omit<Props, 'months' | 'testID' | 'header'>;
type MonthProps = DayOpts & { month: MonthData; weekdays: boolean };

// memo: a tap changes the range, but months the range doesn't touch receive null/null and skip.
const Month = memo(function Month({ month, weekdays, ...o }: MonthProps) {
  const cells: (IsoDate | null)[] = [...Array<null>(month.lead).fill(null), ...month.days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return (
    <View style={{ paddingBottom: space.s6 }}>
      <Text variant="headline" accessibilityRole="header" style={{ paddingBottom: space.s3 }}>
        {month.title}
      </Text>
      {weekdays ? <Weekdays /> : null}
      {rows.map((row) => (
        <View key={row.find((c) => c !== null) ?? 'pad'} style={{ flexDirection: 'row' }}>
          {row.map((d, i) => (
            <View key={d ?? `pad-${String(i)}`} style={{ flex: 1 }}>
              {d === null ? null : <Day day={d} {...o} />}
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
  start,
  end,
  onPick,
  startWord,
  endWord,
  band,
}: DayOpts & { day: IsoDate }) {
  const { minTarget } = useDensity();
  const past = day < today;
  const isStart = day === start;
  const isEnd = day === end;
  const between = start !== null && end !== null && day > start && day < end;
  const edge = isStart || isEnd;
  const suffix =
    isStart && isEnd
      ? `, ${startWord} and ${endWord}`
      : isStart
        ? `, ${startWord}`
        : isEnd
          ? `, ${endWord}`
          : '';
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
        backgroundColor: edge
          ? color.actionFill
          : between
            ? band === 'neutral'
              ? color.wash
              : color.selectedWash
            : 'transparent',
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

/** Weekday row and a scrolling list of months; past days are greyed and can't be chosen. */
export function RangeCalendar({ months = 12, testID, header, ...o }: Props) {
  // Stable list data across renders; rebuilt only when the window changes.
  const data = useMemo(() => buildMonths(o.today, months), [o.today, months]);
  const { start, end } = o;
  return (
    <View style={{ flex: 1, gap: space.s3 }} testID={testID}>
      {header === undefined ? <Weekdays /> : null}
      <FlatList
        {...(header === undefined ? {} : { ListHeaderComponent: header })}
        data={data}
        keyExtractor={(m) => m.key}
        initialNumToRender={3}
        // Perf: months mount a couple at a time as they near the screen, not all at once.
        windowSize={5}
        maxToRenderPerBatch={2}
        renderItem={({ item }) => {
          const first = item.days[0] ?? '';
          const last = item.days[item.days.length - 1] ?? '';
          const touches =
            start !== null && start <= last && (end === null ? start >= first : end >= first);
          return (
            <Month
              month={item}
              weekdays={header !== undefined}
              {...o}
              start={touches ? start : null}
              end={touches ? end : null}
            />
          );
        }}
      />
    </View>
  );
}
