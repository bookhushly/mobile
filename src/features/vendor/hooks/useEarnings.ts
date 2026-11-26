import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { vendorSource } from '@/features/vendor/api/vendorSource';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import { vendorKeys } from '@/features/vendor/hooks/useVendor';
import { VendorError } from '@/features/vendor/hooks/useVendorRequests';
import { createWithdrawKeys } from '@/features/vendor/domain/withdrawKey';
import { otherRefusal, vendorRetry } from '@/features/vendor/hooks/vendorErrors';
import { clock } from '@/shared/api/instance';
import { plainKv } from '@/shared/platform/storage';

type Who = { vendorId: string; kind: ServedKind };

export function useEarnings({ vendorId, kind }: Who) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.earnings(vendorId),
    queryFn: async () => {
      const r = await vendorSource.earnings(kind, clock.serverNow());
      if (!r.ok) throw new VendorError(r.error);
      return r.value;
    },
  });
}

const withdrawKeys = createWithdrawKeys(plainKv, () => Crypto.randomUUID());

/** A refusal the server gave before debiting anything: the key can go. */
const refusedBeforeDebit = (e: unknown) =>
  e instanceof VendorError &&
  (e.apiError.kind === 'conflict' ||
    e.apiError.kind === 'forbidden' ||
    e.apiError.kind === 'validation');

/**
 * Withdraw. The key is kept on the device with its amount until a success or a refusal (see
 * domain/withdrawKey): a timeout or a lost answer never leads to a second debit, even after the
 * vendor leaves the screen.
 */
export function useWithdraw({ vendorId, kind }: Who) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) => {
      const key = await withdrawKeys.forAmount(vendorId, amount);
      const r = await vendorSource.withdraw(kind, amount, key, clock.serverNow());
      if (!r.ok) throw new VendorError(r.error);
      return r.value;
    },
    onSuccess: () => withdrawKeys.clear(vendorId),
    onError: (e) => (refusedBeforeDebit(e) ? withdrawKeys.clear(vendorId) : undefined),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: vendorKeys.earnings(vendorId) }),
        qc.invalidateQueries({ queryKey: vendorKeys.today(vendorId) }),
      ]),
  });
}

export type WithdrawProblem = { title: string; message: string; transient: boolean };

export function withdrawErrorWords(e: unknown): WithdrawProblem {
  const a = e instanceof VendorError ? e.apiError : null;
  if (a?.kind === 'conflict' && a.code === 'insufficient_balance')
    return {
      title: 'That’s more than you have',
      message: 'Some of it may still be on hold. Pull down to refresh and try a smaller amount.',
      transient: false,
    };
  if (a?.kind === 'conflict' && a.code === 'no_bank_account')
    return {
      title: 'Add a bank account first',
      message: 'Add your bank details on bookhushly.com, then withdraw here.',
      transient: false,
    };
  if (a?.kind === 'conflict' && a.code === 'wallet_locked')
    return {
      title: 'Your wallet is locked',
      message: 'Contact Bookhushly support to unlock it before withdrawing.',
      transient: false,
    };
  if (a?.kind === 'conflict' && a.code === 'idempotency_key_reused')
    return {
      title: 'You asked for a different amount a moment ago',
      message: 'Check Activity first: if that withdrawal is there, it’s already on its way.',
      transient: false,
    };
  if (a?.kind === 'forbidden')
    return {
      title: 'Withdrawals are paused on your account',
      message: 'Contact Bookhushly support to find out why.',
      transient: false,
    };
  const other = otherRefusal(a);
  if (other !== null) return other;
  return {
    title: 'We couldn’t reach Bookhushly',
    message:
      'We couldn’t confirm your withdrawal went through. Trying the same amount again won’t send it twice. If it keeps failing, check your balance and Activity first.',
    transient: true,
  };
}
