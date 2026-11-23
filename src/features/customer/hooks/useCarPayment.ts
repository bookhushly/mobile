import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, type NativeEventSubscription } from 'react-native';
import { create } from 'zustand';

import { getCarRequest } from '@/features/customer/api/carRentalApi';
import {
  checkPayment,
  initializePayment,
  verifyPayment,
} from '@/features/customer/api/checkoutApi';
import { planCarPay } from '@/features/customer/domain/carRental/carPay';
import { isPaidStatus } from '@/features/customer/domain/carRental/carStatus';
import { isPaymentUrl, nextPollDelay } from '@/features/customer/domain/checkout/paymentFlow';
import {
  isDefinitiveFailure,
  providerStillProcessing,
  startErrorWords,
} from '@/features/customer/domain/checkout/paymentStatus';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { BROWSER_OPTIONS } from '@/features/customer/hooks/usePayment';
import { carPayStore } from '@/features/customer/offline/carPayStore';
import { api, clock } from '@/shared/api/instance';

// Paying for a chosen car quote (status `matched`). Money rules as for bookings (payments rule):
// the redirect is never proof; "paid" only when the request itself reads paid on the server; a
// failure is final only when Paystack says failed or reversed. The web does NOT reuse an open
// checkout for car rental (BACKEND_STATUS §9), so before any new charge the app asks
// check-status and follows `planCarPay`: reopen this device's own checkout, wait on one that may
// still be paid, or start one only when nothing is open. The reference (and its URL) is on disk
// before the browser opens; if that write fails, the browser doesn't open.

export type CarPayState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'inBrowser' }
  | { kind: 'checking' }
  | { kind: 'paid' }
  /** Not confirmed yet (a transfer clearing, an open checkout, or no answer): never pay again. */
  | { kind: 'notYet' }
  /** Paystack said failed: nothing was taken. */
  | { kind: 'failed' }
  | { kind: 'error'; words: string };

const TRY_AGAIN = 'Couldn’t start payment. Check your connection and try again.';

type PayOnOpen = { id: string | null; ask: (id: string) => void; take: (id: string) => boolean };

/**
 * "Choose and pay" asks the request screen to open checkout once. In memory, never a link
 * parameter, so nothing outside the app can open a checkout.
 */
export const usePayOnOpen = create<PayOnOpen>((set, get) => ({
  id: null,
  ask(id) {
    set({ id });
  },
  take(id) {
    if (get().id !== id) return false;
    set({ id: null });
    return true;
  },
}));

const sleep = (ms: number) =>
  new Promise<void>((r) => {
    setTimeout(r, ms);
  });

export function useCarPayment(
  userId: string,
  id: string,
  matched: boolean,
): {
  state: CarPayState;
  pay: () => void;
  checkAgain: () => void;
  paymentOpen: () => Promise<'clear' | 'open' | 'unknown'>;
} {
  const qc = useQueryClient();
  const [state, setState] = useState<CarPayState>({ kind: 'idle' });
  const alive = useRef(true);
  // Single flight: a second tap before React re-renders must not start another charge.
  const busy = useRef(false);
  const appSub = useRef<NativeEventSubscription | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      appSub.current?.remove();
    };
  }, []);

  const set = (s: CarPayState) => {
    if (alive.current) setState(s);
  };

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: customerKeys.carRequest(userId, id) }),
      qc.invalidateQueries({ queryKey: customerKeys.carRequests(userId) }),
    ]);
  };

  /** True once the request reads paid on the server. */
  const readsPaid = async () => {
    const r = await getCarRequest(api, id);
    return r.ok && isPaidStatus(r.value.status);
  };

  /** One verify, then the request polled on the shared schedule (up to 3 minutes). */
  const settle = async (reference: string) => {
    set({ kind: 'checking' });
    const v = await verifyPayment(api, reference);
    if (v.ok && isDefinitiveFailure(v.value)) {
      await carPayStore.drop(userId, id).catch(() => undefined);
      set({ kind: 'failed' });
      return;
    }
    const clearing = v.ok && providerStillProcessing(v.value.provider_status);
    const began = Date.now();
    for (let attempt = 0; alive.current; attempt += 1) {
      if (await readsPaid()) {
        await carPayStore.drop(userId, id).catch(() => undefined);
        await refresh();
        set({ kind: 'paid' });
        return;
      }
      const wait = nextPollDelay(Date.now() - began, attempt);
      if (wait === null || (clearing && attempt >= 2)) break;
      await sleep(wait);
    }
    set({ kind: 'notYet' });
  };

  const openBrowser = (url: string) =>
    new Promise<void>((resolve) => {
      set({ kind: 'inBrowser' });
      if (Platform.OS === 'android') {
        // The Custom Tab resolves at once; coming back is the app turning active.
        appSub.current?.remove();
        appSub.current = AppState.addEventListener('change', (s) => {
          if (s !== 'active') return;
          appSub.current?.remove();
          appSub.current = null;
          resolve();
        });
      }
      WebBrowser.openBrowserAsync(url, BROWSER_OPTIONS)
        .then((res) => {
          if (Platform.OS !== 'android' && res.type !== WebBrowser.WebBrowserResultType.OPENED)
            resolve();
        })
        .catch(() => {
          appSub.current?.remove();
          appSub.current = null;
          resolve();
        });
    });

  /** A new charge: initialise, save the reference, then (only then) open the checkout. */
  const startNew = async () => {
    const r = await initializePayment(api, 'car_rental', id);
    if (!r.ok) {
      set({ kind: 'error', words: startErrorWords(r.error) });
      return;
    }
    const { reference, payment_url: url } = r.value.payment;
    if (!isPaymentUrl(url)) {
      set({ kind: 'error', words: TRY_AGAIN });
      return;
    }
    try {
      await carPayStore.put(userId, id, { reference, url, startedAt: clock.serverNow() });
    } catch {
      // Without the reference on disk a checkout we can't find again is never opened.
      set({ kind: 'error', words: 'Couldn’t save this payment on your phone. Try again.' });
      return;
    }
    await openBrowser(url);
    await settle(reference);
  };

  const run = (work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    void work().finally(() => {
      busy.current = false;
    });
  };

  const pay = () => {
    run(async () => {
      set({ kind: 'starting' });
      const [c, stored] = await Promise.all([
        checkPayment(api, 'car_rental', id),
        carPayStore.get(userId, id),
      ]);
      const plan = planCarPay(c.ok ? c.value : null, stored, clock.serverNow());
      switch (plan.kind) {
        case 'cantCheck':
          set({ kind: 'error', words: TRY_AGAIN });
          return;
        case 'paid':
        case 'wait':
          await settle(plan.reference);
          return;
        case 'reopen':
          await openBrowser(plan.url);
          await settle(plan.reference);
          return;
        case 'verifyThenStart': {
          const v = await verifyPayment(api, plan.reference);
          if (!v.ok) {
            set({ kind: 'error', words: TRY_AGAIN });
            return;
          }
          if (v.value.verified || providerStillProcessing(v.value.provider_status)) {
            await settle(plan.reference);
            return;
          }
          await startNew();
          return;
        }
        case 'start':
          await startNew();
          return;
      }
    });
  };

  const checkAgain = () => {
    run(async () => {
      const [c, stored] = await Promise.all([
        checkPayment(api, 'car_rental', id),
        carPayStore.get(userId, id),
      ]);
      const ref =
        c.ok && (c.value.hasPaid || c.value.hasPending)
          ? c.value.payment.reference
          : stored?.reference;
      if (ref !== undefined) {
        await settle(ref);
        return;
      }
      if (await readsPaid()) {
        await refresh();
        set({ kind: 'paid' });
      } else set({ kind: 'idle' });
    });
  };

  // A payment left open (app closed in the browser): settle it once when the screen opens.
  const resumed = useRef(false);
  useEffect(() => {
    if (!matched || resumed.current || userId === '') return;
    resumed.current = true;
    void carPayStore.get(userId, id).then((s) => {
      if (s === null || !alive.current) return;
      run(() => settle(s.reference));
    });
    // settle and run are recreated each render; this runs once per screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, userId, id]);

  /**
   * Before cancelling a chosen quote: is a payment for it possibly under way anywhere (the web,
   * another phone, before a sign-out)? 'open' when the server has a completed one or a recent
   * pending one; 'unknown' when it couldn't say. Only 'clear' may cancel.
   */
  const paymentOpen = async (): Promise<'clear' | 'open' | 'unknown'> => {
    const c = await checkPayment(api, 'car_rental', id);
    if (!c.ok) return 'unknown';
    const plan = planCarPay(c.value, null, clock.serverNow());
    if (plan.kind === 'start') return 'clear';
    if (plan.kind !== 'verifyThenStart') return 'open';
    // An older open payment may be a transfer still clearing: Paystack says which.
    const v = await verifyPayment(api, plan.reference);
    if (!v.ok) return 'unknown';
    return v.value.verified || providerStillProcessing(v.value.provider_status) ? 'open' : 'clear';
  };

  return { state, pay, checkAgain, paymentOpen };
}
