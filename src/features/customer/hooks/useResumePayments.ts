import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { paymentState, verifyPayment } from '@/features/customer/api/checkoutApi';
import { isFreshPayment } from '@/features/customer/domain/checkout/paymentFlow';
import {
  fromPaymentState,
  fromVerified,
  type PayVerdict,
} from '@/features/customer/domain/checkout/paymentStatus';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { isPayScreenOpen } from '@/features/customer/hooks/openPayScreens';
import { checkoutStore } from '@/features/customer/offline/checkoutStore';
import { api, clock } from '@/shared/api/instance';

/**
 * Spec P5: a payment left open when the app was killed or backgrounded is settled quietly. On
 * mount and each return to the foreground, every stored entry with a payment is read, one entry
 * at a time, skipping a booking whose Pay screen is open (that screen settles it).
 *
 * A1: a payment started under 15 min ago gets one status read only, never verify (web marks a
 * transfer or USSD still in progress as failed), and only 'paid' settles it: its 'failed' may
 * still complete. An older one gets verify, then a status read. Paid drops the entry, failed
 * clears its payment, each only while the entry still holds that reference (A4); anything else is
 * left for the next pass. It never initialises.
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

    const settleOne = async (reference: string, startedAt: number): Promise<PayVerdict> => {
      if (isFreshPayment(startedAt, clock.serverNow())) {
        const s = await paymentState(api, reference);
        const v = s.ok ? fromPaymentState(s.value) : 'unknown';
        return v === 'paid' ? 'paid' : 'unknown';
      }
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
        if (isPayScreenOpen(userId, e.kind, e.bookingId)) continue;
        const { reference } = e.payment;
        const verdict = await settleOne(reference, e.payment.startedAt);
        if (!live()) return;
        if (verdict !== 'paid' && verdict !== 'failed') continue;
        // Paid drops the entry; failed keeps it, payment cleared, for Try again (R8).
        if (verdict === 'paid') await checkoutStore.drop(userId, e.kind, e.bookingId, reference);
        else await checkoutStore.clearPayment(userId, e.kind, e.bookingId, reference);
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
