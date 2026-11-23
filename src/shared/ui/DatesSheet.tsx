import { useCallback, useState } from 'react';

import { daysBetween, shortDate, type IsoDate } from '@/shared/lib/lagosDay';

import { Button } from './Button';
import { RangeCalendar } from './RangeCalendar';
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

function nightsLabel(n: number): string {
  return n === 1 ? '1 night' : `${String(n)} nights`;
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
      <RangeCalendar
        today={today}
        months={months}
        start={checkIn}
        end={checkOut}
        onPick={pick}
        startWord="check-in"
        endWord="check-out"
      />
    </Sheet>
  );
}
