import { useQuery } from '@tanstack/react-query';

import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { wallet, type Wallet } from '@/features/customer/offline/wallet';

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
    // Re-read from disk each time it is needed again: a newer save may have landed.
    staleTime: 0,
    retry: false,
  });
  return { wallet: enabled ? w.data : undefined };
}
