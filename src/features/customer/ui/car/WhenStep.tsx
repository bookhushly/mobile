import { ArrowRight } from 'lucide-react-native';
import { useCallback } from 'react';
import { View } from 'react-native';

import { pickDay, type CarDraft } from '@/features/customer/domain/carRental/carRequest';
import { useCarDraft } from '@/features/customer/hooks/useCarDraft';
import { timeWords } from '@/features/customer/ui/car/carWords';
import { shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { FilterChips, Icon, RangeCalendar, Text } from '@/shared/ui';

type Props = {
  draft: CarDraft;
  today: IsoDate;
  onChange: (p: Partial<CarDraft>) => void;
};

function Box({ label, value, active }: { label: string; value: string | null; active: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        gap: space.s1,
        padding: space.s4,
        borderRadius: radius.r3,
        borderWidth: active ? borderWidth.thick : borderWidth.hairline,
        borderColor: active ? color.textPrimary : color.borderStrong,
      }}
    >
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Text
        variant="bodyStrong"
        tone={value === null ? 'textMuted' : 'textPrimary'}
        numberOfLines={1}
      >
        {value ?? 'Add date'}
      </Text>
    </View>
  );
}

// Step 2, after Turo and Agoda: Pick-up → Return on top, then the months scroll. A single tap is a
// one-day trip; tapping the same day again makes that explicit.
export function WhenStep({ draft, today, onChange }: Props) {
  const { pickupDate, returnDate } = draft;
  // Stable across taps (the store's patch is stable and the dates are read when tapped), so months
  // the range doesn't touch skip re-rendering (RangeCalendar's memo).
  const pick = useCallback(
    (d: IsoDate) => {
      onChange(pickDay(useCarDraft.getState().draft, d));
    },
    [onChange],
  );
  const choosingReturn = pickupDate !== null && returnDate === null;
  return (
    <View style={{ flex: 1, gap: space.s5 }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}
        accessible
        accessibilityLabel={`Pick-up ${pickupDate === null ? 'not chosen' : shortDate(pickupDate)}, return ${returnDate === null ? 'not chosen' : shortDate(returnDate)}`}
      >
        <Box
          label="Pick-up"
          value={pickupDate === null ? null : shortDate(pickupDate)}
          active={pickupDate === null}
        />
        <Icon as={ArrowRight} size="sm" tone="textSecondary" />
        <Box
          label="Return"
          value={returnDate === null ? null : shortDate(returnDate)}
          active={choosingReturn}
        />
      </View>
      <RangeCalendar
        today={today}
        months={12}
        start={pickupDate}
        end={returnDate}
        onPick={pick}
        startWord="pick-up"
        endWord="return"
        band="neutral"
        testID="car-calendar"
      />
    </View>
  );
}

const TIMES = Array.from({ length: 15 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);
const TIME_OPTIONS = [
  { value: 'any', label: 'Any time' },
  ...TIMES.map((t) => ({ value: t, label: timeWords(t) })),
] as const;

/** Pick-up time, in the footer just above Next. */
export function PickupTimeChips({ draft, onChange }: Omit<Props, 'today'>) {
  return (
    <View style={{ gap: space.s2 }}>
      <Text variant="label">Pick-up time</Text>
      <FilterChips
        label="Pick-up time"
        value={draft.pickupTime ?? 'any'}
        options={TIME_OPTIONS}
        onChange={(v) => {
          onChange({ pickupTime: v === 'any' ? null : v });
        }}
        testID="car-pickup-time"
      />
    </View>
  );
}
