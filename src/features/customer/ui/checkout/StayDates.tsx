import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';

import { clock } from '@/shared/api/instance';
import { lagosToday, stayRange } from '@/shared/lib/lagosDay';
import { DatesSheet, Icon, ListRow, Stack, Text } from '@/shared/ui';

type Props = {
  checkIn: string | null;
  checkOut: string | null;
  minNights: number;
  error: string | undefined;
  onDates: (d: { checkIn: string; checkOut: string }) => void;
};

// Mobbin §1: a dates line that opens the month sheet; the minimum stay is said up front.
export function StayDates({ checkIn, checkOut, minNights, error, onDates }: Props) {
  const [open, setOpen] = useState(false);
  const chosen = checkIn !== null && checkOut !== null;
  return (
    <Stack gap="s2">
      <ListRow
        title="Dates"
        subtitle={chosen ? stayRange(checkIn, checkOut) : 'Add your dates'}
        leading={<Icon as={CalendarDays} size="sm" tone="textSecondary" />}
        onPress={() => {
          setOpen(true);
        }}
        testID="dates-row"
      />
      {minNights > 1 ? (
        <Text variant="bodySm" tone="textSecondary" testID="min-nights">
          {`At least ${String(minNights)} nights`}
        </Text>
      ) : null}
      {error !== undefined ? (
        <Text
          variant="bodySm"
          tone="dangerFg"
          accessibilityLiveRegion="polite"
          testID="dates-error"
        >
          {error}
        </Text>
      ) : null}
      <DatesSheet
        visible={open}
        today={lagosToday(clock.serverNow())}
        minNights={minNights}
        initial={{ checkIn, checkOut }}
        onDone={(d) => {
          setOpen(false);
          onDates(d);
        }}
        onClose={() => {
          setOpen(false);
        }}
      />
    </Stack>
  );
}
