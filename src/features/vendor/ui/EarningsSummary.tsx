import { Landmark } from 'lucide-react-native';
import { View } from 'react-native';

import { bankLabel, type Earnings } from '@/features/vendor/domain/earnings';
import { MonthCard } from '@/features/vendor/ui/MonthCard';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Banner, Button, formatNaira, Icon, Text } from '@/shared/ui';

function MoneyRow({
  label,
  detail,
  value,
  first,
}: {
  label: string;
  detail: string;
  value: number;
  first: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${formatNaira(value)}. ${detail}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        paddingVertical: space.s5,
        borderTopWidth: first ? 0 : borderWidth.hairline,
        borderTopColor: color.border,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: space.s1 }}>
        <Text variant="label" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="caption" tone="textSecondary" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text variant="title" tabular numberOfLines={1}>
        {formatNaira(value)}
      </Text>
    </View>
  );
}

type Props = {
  earnings: Earnings;
  labels: { thisMonth: string; lastMonth: string };
  onOpenWeb: () => void;
};

/** The top of Earnings: the month, the money you can take out and what's held, where it's paid. */
export function EarningsSummary({ earnings: e, labels, onOpenWeb }: Props) {
  const w = e.wallet;
  return (
    <View style={{ gap: space.s6, paddingBottom: space.s4 }}>
      <Text variant="titleLg" accessibilityRole="header">
        Earnings
      </Text>
      <MonthCard
        now={e.month.now}
        then={e.month.then}
        daysInMonth={e.month.daysInMonth}
        thisMonth={labels.thisMonth}
        lastMonth={labels.lastMonth}
      />
      {w === null ? null : (
        <View
          style={{
            backgroundColor: color.wash,
            borderRadius: radius.r4,
            paddingHorizontal: space.s5,
          }}
        >
          <MoneyRow label="To withdraw" detail="Yours now" value={w.available} first />
          <MoneyRow
            label="On hold"
            detail={
              w.heldJobs === 0
                ? 'Nothing waiting'
                : `Until ${String(w.heldJobs)} ${w.heldJobs === 1 ? 'customer confirms' : 'customers confirm'}`
            }
            value={w.held}
            first={false}
          />
        </View>
      )}
      {e.rail !== 'bank' ? null : e.bank === null ? (
        <>
          <Banner
            tone="neutral"
            title="Add your bank details to be paid"
            message="Bookhushly can’t send your money until your settlement account is set up on bookhushly.com."
          />
          <Button label="Open bookhushly.com" variant="secondary" onPress={onOpenWeb} />
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.s4, alignItems: 'center' }}>
          <Icon as={Landmark} size="md" />
          <Text variant="bodySm" style={{ flex: 1 }}>
            {`Paystack pays your share to ${bankLabel(e.bank)} after each booking.`}
          </Text>
        </View>
      )}
      <Text variant="headline" accessibilityRole="header">
        Activity
      </Text>
    </View>
  );
}
