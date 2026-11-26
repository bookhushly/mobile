import { Wallet } from 'lucide-react-native';
import { FlatList, RefreshControl, View } from 'react-native';

import { WITHDRAW_MIN, type Earnings } from '@/features/vendor/domain/earnings';
import { ActivityRow } from '@/features/vendor/ui/ActivityRow';
import { EarningsSummary } from '@/features/vendor/ui/EarningsSummary';
import { space } from '@/shared/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  formatNaira,
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

  // Activity holds up to 100 payments: a list that draws only what's on screen.
  return (
    <Screen footer={footer}>
      <FlatList
        data={e.activity}
        style={{ flex: 1 }}
        keyExtractor={(a) => a.id}
        initialNumToRender={8}
        windowSize={7}
        ListHeaderComponent={<EarningsSummary earnings={e} labels={labels} onOpenWeb={onOpenWeb} />}
        renderItem={({ item }) => <ActivityRow activity={item} />}
        ListEmptyComponent={
          <EmptyState
            icon={Wallet}
            title="No payments yet"
            message="Money from finished jobs shows here."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={state.refresh}
            {...refreshColors}
          />
        }
      />
    </Screen>
  );
}
