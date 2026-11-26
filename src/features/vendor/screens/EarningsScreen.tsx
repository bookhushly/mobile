import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import {
  activityLine,
  bankLabel,
  WITHDRAW_MIN,
  type Earnings,
} from '@/features/vendor/domain/earnings';
import { MonthCard } from '@/features/vendor/ui/MonthCard';
import { borderWidth, color, radius, space } from '@/shared/theme';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  formatNaira,
  Icon,
  refreshColors,
  Screen,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  labels: { thisMonth: string; lastMonth: string };
  state:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; earnings: Earnings; refreshing: boolean; refresh: () => void };
  onWithdraw: () => void;
  onOpenWeb: () => void;
};

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

/** Earnings (design v13): the month against last month, the money you can take out, every payment. */
export function EarningsScreen({ labels, state, onWithdraw, onOpenWeb }: Props) {
  if (state.status !== 'ready')
    return (
      <Screen scroll>
        <View style={{ gap: space.s5, paddingTop: space.s5 }}>
          <Text variant="titleLg" accessibilityRole="header">
            Earnings
          </Text>
          {state.status === 'loading' ? (
            <SkeletonRows count={5} />
          ) : (
            <ErrorState
              title="We couldn’t load your earnings"
              message="Your money is safe. Check your connection and try again."
              onRetry={state.retry}
            />
          )}
        </View>
      </Screen>
    );

  const e = state.earnings;
  const w = e.wallet;
  const canWithdraw = w !== null && e.bank !== null && w.available >= WITHDRAW_MIN;
  const footer =
    e.rail !== 'wallet' ? undefined : (
      <View style={{ gap: space.s3 }}>
        {e.bank === null ? (
          <Text variant="caption" tone="textSecondary" align="center">
            Add a bank account on bookhushly.com to withdraw.
          </Text>
        ) : w !== null && w.available < WITHDRAW_MIN ? (
          <Text variant="caption" tone="textSecondary" align="center">
            {`You can withdraw once you have ${formatNaira(WITHDRAW_MIN)}.`}
          </Text>
        ) : null}
        <Button
          label="Withdraw"
          disabled={!canWithdraw}
          onPress={onWithdraw}
          testID="vendor-withdraw"
        />
      </View>
    );

  return (
    <Screen
      scroll
      footer={footer}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          {...refreshColors}
        />
      }
    >
      <View style={{ gap: space.s6, paddingTop: space.s5, paddingBottom: space.s7 }}>
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

        {e.rail === 'bank' ? (
          e.bank === null ? (
            <Banner
              tone="neutral"
              title="Add your bank details to be paid"
              message="Bookhushly can’t send your money until your settlement account is set up on bookhushly.com."
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: space.s4, alignItems: 'center' }}>
              <Icon as={Landmark} size="md" />
              <Text variant="bodySm" style={{ flex: 1 }}>
                {`Paystack pays your share to ${bankLabel(e.bank)} after each booking.`}
              </Text>
            </View>
          )
        ) : null}
        {e.rail === 'bank' && e.bank === null ? (
          <Button label="Open bookhushly.com" variant="secondary" onPress={onOpenWeb} />
        ) : null}

        <View>
          <Text variant="headline" accessibilityRole="header">
            Activity
          </Text>
          {e.activity.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments yet"
              message="Money from finished jobs shows here."
            />
          ) : (
            e.activity.map((a) => {
              const out = a.kind === 'withdrawal';
              return (
                <View
                  key={a.id}
                  accessible
                  accessibilityLabel={`${a.title}, ${out ? 'out' : 'in'} ${formatNaira(a.amount)}, ${activityLine(a)}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.s4,
                    paddingVertical: space.s4,
                    borderBottomWidth: borderWidth.hairline,
                    borderBottomColor: color.border,
                  }}
                >
                  <Icon as={out ? ArrowUpRight : ArrowDownLeft} size="md" />
                  <View style={{ flex: 1, minWidth: 0, gap: space.s1 }}>
                    <Text variant="label" numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text variant="caption" tone="textSecondary" numberOfLines={1}>
                      {activityLine(a)}
                    </Text>
                  </View>
                  <Text variant="label" tabular>
                    {`${out ? '−' : '+'}${formatNaira(a.amount)}`}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </View>
    </Screen>
  );
}
