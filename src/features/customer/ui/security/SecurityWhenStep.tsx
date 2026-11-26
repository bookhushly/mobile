import { ArrowRight } from 'lucide-react-native';
import { useCallback, type ReactElement } from 'react';
import { View } from 'react-native';

import { pickDay } from '@/features/customer/domain/carRental/carRequest';
import type { SecurityDraft } from '@/features/customer/domain/security/securityRequest';
import { useSecurityDraft } from '@/features/customer/hooks/useSecurity';
import { shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, RangeCalendar, Text } from '@/shared/ui';

type Props = {
  draft: SecurityDraft;
  today: IsoDate;
  /** The step's heading, scrolled with the calendar. */
  title: ReactElement;
  onChange: (p: Partial<SecurityDraft>) => void;
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

// Step 3 (the shared calendar): the first tap is the start, a second sets an end (optional:
// ongoing contracts have none). The title and boxes scroll with the months.
export function SecurityWhenStep({ draft, today, title, onChange }: Props) {
  const { startDate, endDate } = draft;
  // Stable across taps (the store's patch is stable and the dates are read when tapped).
  const pick = useCallback(
    (d: IsoDate) => {
      const cur = useSecurityDraft.getState().draft;
      const next = pickDay({ pickupDate: cur.startDate, returnDate: cur.endDate }, d);
      onChange({ startDate: next.pickupDate, endDate: next.returnDate });
    },
    [onChange],
  );
  const header = (
    <View style={{ gap: space.s5, paddingBottom: space.s5 }}>
      {title}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}
        accessible
        accessibilityLabel={`Starts ${startDate === null ? 'not chosen' : shortDate(startDate)}, ends ${endDate === null ? 'not set' : shortDate(endDate)}`}
      >
        <DateBox
          label="Starts"
          value={startDate === null ? null : shortDate(startDate)}
          active={startDate === null}
        />
        <Icon as={ArrowRight} size="sm" tone="textSecondary" />
        <DateBox
          label="Ends (optional)"
          value={endDate === null ? null : shortDate(endDate)}
          active={startDate !== null && endDate === null}
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
        start={startDate}
        end={endDate}
        onPick={pick}
        startWord="start"
        endWord="end"
        band="neutral"
        testID="security-calendar"
      />
    </View>
  );
}
