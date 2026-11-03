import { useEffect, useRef } from 'react';

import type { PromoState } from '@/features/customer/hooks/usePromo';

type Promo = {
  state: PromoState;
  apply: (code: string, amount: number) => Promise<void>;
};

/**
 * Re-applies an applied code once when `userId` goes from none to someone: the preview was asked
 * for signed out. Create re-checks the code either way; this keeps what the person sees honest.
 */
export function useRecheckPromoOnSignIn(userId: string, promo: Promo, amount: number | null): void {
  const previous = useRef(userId);
  useEffect(() => {
    const was = previous.current;
    previous.current = userId;
    if (was !== '' || userId === '') return;
    if (promo.state.phase !== 'applied' || amount === null) return;
    void promo.apply(promo.state.promo.code, amount);
  }, [userId, promo, amount]);
}
