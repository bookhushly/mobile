import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { wallet, type Wallet } from '@/features/customer/offline/wallet';
import { clock } from '@/shared/api/instance';
import { lagosToday, type IsoDate } from '@/shared/lib/lagosDay';

// Lagos today, re-read whenever `stamp` changes (a fetch settles: focus, foreground, pull). Held
// in state rather than read in render: the React Compiler may cache an input-less render read.
export function useTodayAt(stamp: string): IsoDate {
  const [held, setHeld] = useState(() => ({ stamp, today: lagosToday(clock.serverNow()) }));
  if (held.stamp !== stamp) {
    const next = { stamp, today: lagosToday(clock.serverNow()) };
    setHeld(next);
    return next.today;
  }
  return held.today;
}

/**
 * The offline wallet as saved on disk, read only while `enabled` (a network load has failed).
 * `wallet` is null when there is none (or it can't be read); undefined while reading.
 */
export function useSavedWallet(
  userId: string,
  enabled: boolean,
): { wallet: Wallet | null | undefined } {
  const w = useQuery({
    queryKey: customerKeys.wallet(userId),
    // A wallet that can't be read (corrupt blob, Keychain error) is the same as no wallet.
    queryFn: () => wallet.load(userId).catch(() => null),
    enabled,
    // It reads the disk: offline is exactly when it must run.
    networkMode: 'always',
    // Re-read from disk each time it is needed again: a newer save may have landed.
    staleTime: 0,
    retry: false,
  });
  return { wallet: enabled ? w.data : undefined };
}
