import { ArrowRight } from 'lucide-react-native';
import { useCallback, type ReactElement } from 'react';
import { View } from 'react-native';

import { pickDay } from '@/features/customer/domain/carRental/carRequest';
import type { LogisticsDraft } from '@/features/customer/domain/logistics/logisticsRequest';
import { useLogisticsDraft } from '@/features/customer/hooks/useLogisticsDraft';
import { shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, RangeCalendar, Text } from '@/shared/ui';

type Props = {
  draft: LogisticsDraft;
  today: IsoDate;
  /** The step's heading, scrolled with the calendar. */
  title: ReactElement;
  onChange: (p: Partial<LogisticsDraft>) => void;
};

function DateBox({
  label,
  value,
  active,
}: {
  label: string;
  value: string | null;
  active: boolean;
}) {
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

// Step 4 (the car rental calendar): the first tap is the pick-up day, a second sets "arrive by"
// (optional). The title and boxes scroll with the months, so small phones keep the calendar.
export function LogisticsWhenStep({ draft, today, title, onChange }: Props) {
  const { pickupDate, deliveryDate } = draft;
  // Stable across taps (the store's patch is stable and the dates are read when tapped).
  const pick = useCallback(
    (d: IsoDate) => {
      const cur = useLogisticsDraft.getState().draft;
      const next = pickDay({ pickupDate: cur.pickupDate, returnDate: cur.deliveryDate }, d);
      onChange({ pickupDate: next.pickupDate, deliveryDate: next.returnDate });
    },
    [onChange],
  );
  const header = (
    <View style={{ gap: space.s5, paddingBottom: space.s5 }}>
      {title}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}
        accessible
        accessibilityLabel={`Pick-up ${pickupDate === null ? 'not chosen' : shortDate(pickupDate)}, arrive by ${deliveryDate === null ? 'not set' : shortDate(deliveryDate)}`}
      >
        <DateBox
          label="Pick-up"
          value={pickupDate === null ? null : shortDate(pickupDate)}
          active={pickupDate === null}
        />
        <Icon as={ArrowRight} size="sm" tone="textSecondary" />
        <DateBox
          label="Arrive by (optional)"
          value={deliveryDate === null ? null : shortDate(deliveryDate)}
          active={pickupDate !== null && deliveryDate === null}
        />
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <RangeCalendar
        header={header}
        today={today}
        months={12}
        start={pickupDate}
        end={deliveryDate}
        onPick={pick}
        startWord="pick-up"
        endWord="arrive by"
        band="neutral"
        testID="logistics-calendar"
      />
    </View>
  );
}
