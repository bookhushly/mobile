import { useState } from 'react';

import { monthLabels } from '@/features/vendor/domain/today';
import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import { useEarnings, useWithdraw, withdrawErrorWords } from '@/features/vendor/hooks/useEarnings';
import { EarningsScreen } from '@/features/vendor/screens/EarningsScreen';
import { WithdrawSheet } from '@/features/vendor/ui/WithdrawSheet';
import { clock } from '@/shared/api/instance';
import { lagosToday } from '@/shared/lib/lagosDay';

export function VendorEarnings() {
  const { vendor, openWeb } = useVendorSession();
  const who = { vendorId: vendor.id, kind: vendor.kind };
  const q = useEarnings(who);
  const withdraw = useWithdraw(who);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const e = q.data;
  return (
    <>
      <EarningsScreen
        labels={monthLabels(lagosToday(clock.serverNow()))}
        onOpenWeb={() => {
          openWeb('/vendor/dashboard/wallet');
        }}
        onWithdraw={() => {
          withdraw.reset();
          setDone(null);
          setOpen(true);
        }}
        state={
          q.isPending
            ? { status: 'loading' }
            : q.isError
              ? { status: 'error', retry: () => void q.refetch() }
              : {
                  status: 'ready',
                  earnings: q.data,
                  refreshing,
                  refresh: () => {
                    setRefreshing(true);
                    void q.refetch().finally(() => {
                      setRefreshing(false);
                    });
                  },
                }
        }
      />
      {open && e?.wallet && e.bank ? (
        <WithdrawSheet
          visible
          available={e.wallet.available}
          bank={e.bank}
          busy={withdraw.isPending}
          problem={withdraw.isError ? withdrawErrorWords(withdraw.error) : null}
          done={done}
          onWithdraw={(amount) => {
            if (withdraw.isPending) return;
            withdraw.mutate(amount, {
              onSuccess: () => {
                setDone(amount);
              },
            });
          }}
          onClose={() => {
            if (withdraw.isPending) return;
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
