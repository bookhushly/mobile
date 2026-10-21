import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { paymentState, verifyPayment } from '@/features/customer/api/checkoutApi';
import {
  fromPaymentState,
  fromVerified,
  type PayVerdict,
} from '@/features/customer/domain/checkout/paymentStatus';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
// Importing the store registers its sign-out wipe (P5): the customer layout mounts this hook.
import { checkoutStore } from '@/features/customer/offline/checkoutStore';
import { api } from '@/shared/api/instance';

/**
 * Spec P5: a payment left open when the app was killed or backgrounded is settled quietly. On
 * mount and each return to the foreground, every stored entry with a payment gets verify, then
 * one status read, one entry at a time. Paid or failed drops the entry; anything else is left for
 * the next pass. It never initialises.
 */
export function useResumePayments(userId: string): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (userId === '') return;
    let on = true;
    let running = false;
    let again = false;
    // Calls, not reads: TypeScript would keep these narrowed across an await.
    const live = () => on;
    const rerun = () => again;

    const settleOne = async (reference: string): Promise<PayVerdict> => {
      const v = await verifyPayment(api, reference);
      const s = await paymentState(api, reference);
      if (s.ok) return fromPaymentState(s.value);
      // No status answer: only a definite failure from verify settles it.
      return v.ok && fromVerified(v.value) === 'failed' ? 'failed' : 'unknown';
    };

    const pass = async () => {
      const entries = await checkoutStore.list(userId);
      for (const e of entries) {
        if (!live()) return;
        if (e.payment === null) continue;
        const verdict = await settleOne(e.payment.reference);
        if (!live()) return;
        if (verdict !== 'paid' && verdict !== 'failed') continue;
        await checkoutStore.drop(userId, e.kind, e.bookingId);
        void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
        void qc.invalidateQueries({ queryKey: customerKeys.booking(userId, e.kind, e.bookingId) });
        if (verdict === 'paid')
          void qc.invalidateQueries({ queryKey: customerKeys.wallet(userId) });
      }
    };

    // One pass at a time; a trigger during a pass runs one more after it.
    const run = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          await pass().catch(() => undefined);
        } while (rerun() && live());
      } finally {
        running = false;
      }
    };

    void run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    return () => {
      on = false;
      sub.remove();
    };
  }, [userId, qc]);
}
