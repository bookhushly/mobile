import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type NativeEventSubscription } from 'react-native';

import { cancelBooking } from '@/features/customer/api/bookingActionsApi';
import {
  checkPayment,
  initializePayment,
  paymentState,
  verifyPayment,
} from '@/features/customer/api/checkoutApi';
import {
  afterPendingVerify,
  flow,
  holdEndsAt as holdEnd,
  isFreshPayment,
  isPaymentUrl,
  planPay,
  type FlowEvent,
  type FlowState,
  type RowPayState,
} from '@/features/customer/domain/checkout/paymentFlow';
import {
  fromPaymentState,
  fromVerified,
  startErrorAction,
  startErrorWords,
  type PayVerdict,
} from '@/features/customer/domain/checkout/paymentStatus';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { holdPayScreen } from '@/features/customer/hooks/openPayScreens';
import { useServerNow } from '@/features/customer/hooks/useServerNow';
import { checkoutStore, type CheckoutEntry } from '@/features/customer/offline/checkoutStore';
import { api, clock } from '@/shared/api/instance';

// Spec P4–P8, P26, P29. Money rules: one initialise per tap, only after check-status says there
// is no reusable reference; the reference is on disk before the browser opens; Done only from a
// fulfilled status poll; a hold past 25 min on the server clock never initialises. A payment
// started under 15 min ago is never verified and its failure is never final (A1).

export type PayKind = 'hotel' | 'apartment' | 'event';

export const BROWSER_OPTIONS = { createTask: false, showInRecents: false } as const;

const HOLD_ENDED_WORDS = 'This hold has ended. Start again';
const START_FAILED_WORDS = "Couldn't start payment. Try again";

/** Steps where Pay (re)starts P4. Try again after a failure goes back to Review first (A1d). */
const PAYABLE: ReadonlySet<FlowState['step']> = new Set(['review', 'startError']);
/** Steps that leave an unpaid booking behind when the user walks away (P7). */
const LEAVE_CANCELS: ReadonlySet<FlowState['step']> = new Set([
  'review',
  'startError',
  'holdEnded',
]);

/**
 * P7 (amended A2a), the synchronous part: leaving cancels only a booking made on Select in this
 * session, read from disk, never paid for, ever, whose row still reads unpaid. leave() then asks
 * check-status before it cancels.
 */
function cancelsOnLeave(
  fromSelect: boolean,
  rowState: RowPayState | null,
  step: FlowState['step'],
  sawPayment: boolean,
  entryLoaded: boolean,
  e: CheckoutEntry | null,
): boolean {
  return (
    fromSelect &&
    rowState === 'unpaid' &&
    LEAVE_CANCELS.has(step) &&
    !sawPayment &&
    entryLoaded &&
    e !== null &&
    !e.paymentEverStarted &&
    e.payment === null
  );
}

export function usePayment(
  userId: string,
  kind: PayKind,
  bookingId: string,
  booking: {
    /** The booking row's `created_at`, when loaded; the cached entry's wins. */
    createdAt: string | null;
    /** Where Paystack sends the receipt; the cached entry's guest email wins. */
    email: string | null;
    /** For the entry written when none is cached (Pay now from Bookings, an adopted event). */
    title?: string;
    total?: number;
    /** What the loaded row says (A2): cancelled or paid never pays; only unpaid may cancel. */
    rowState: RowPayState | null;
    /** Reached from Select in this session (`?from=select`): only then may leaving cancel. */
    fromSelect: boolean;
  },
): {
  state: FlowState;
  pay: () => void;
  /** Failed → Review: Pay needs a fresh tap (A1d). */
  retry: () => void;
  checkAgain: () => void;
  leave: () => void;
  /** leave() would cancel the booking now (P7): Review offers Cancel booking only then. */
  willCancelOnLeave: boolean;
  /** Stays: when Pay stops (epoch ms, server clock). Null for events, or while unknown. */
  holdEndsAt: number | null;
  /** Pay can start: the stay's age is known, its hold hasn't ended, the row isn't paid or cancelled. */
  canPay: boolean;
  /** An earlier payment on this booking started under 15 min ago: Review warns before Pay (A1d). */
  recentAttempt: boolean;
  entry: CheckoutEntry | null;
} {
  const qc = useQueryClient();
  const [state, setState] = useState<FlowState>({ step: 'review' });
  const current = useRef<FlowState>(state);
  const [entry, setEntry] = useState<CheckoutEntry | null>(null);
  const entryRef = useRef<CheckoutEntry | null>(null);
  const live = useRef(true);
  /** The cached entry has been read (it may be null). Until then leaving never cancels. */
  const entryLoaded = useRef(false);
  /** This mount saw a reference, or sent initialise: leaving must never cancel (P7). */
  const sawPayment = useRef(false);
  // Render-time copies of the two refs above, for `willCancelOnLeave`.
  const [sawPay, setSawPay] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /** When the latest payment on this booking was started (server clock), if known. */
  const [attemptAt, setAttemptAt] = useState<number | null>(null);
  const appSub = useRef<NativeEventSubscription | null>(null);
  const now = useServerNow();
  // A call, not a read: TypeScript would keep `live.current` narrowed across an await.
  const alive = useCallback(() => live.current, []);

  // Read after a send: the step it just moved to (not the narrowed one from before).
  const stepNow = useCallback((): FlowState['step'] => current.current.step, []);
  const send = useCallback(
    (ev: FlowEvent) => {
      if (!alive()) return;
      const next = flow(current.current, ev);
      if (next === current.current) return;
      current.current = next;
      setState(next);
    },
    [alive],
  );

  useEffect(() => {
    live.current = true;
    let on = true;
    void checkoutStore
      .get(userId, kind, bookingId)
      .then((e) => {
        if (!on) return;
        entryRef.current = e;
        entryLoaded.current = true;
        setLoaded(true);
        setEntry(e);
        if (e?.payment) {
          const at = e.payment.startedAt;
          setAttemptAt((a) => (a === null ? at : Math.max(a, at)));
        }
      })
      .catch(() => undefined);
    return () => {
      on = false;
      live.current = false;
      appSub.current?.remove();
      appSub.current = null;
    };
  }, [userId, kind, bookingId]);

  // Resume (P5) leaves this booking to this screen while it is open (A1).
  useEffect(() => holdPayScreen(userId, kind, bookingId), [userId, kind, bookingId]);

  const createdAt = entry?.createdAt ?? booking.createdAt;
  const holdEndsAt = kind === 'event' || createdAt === null ? null : holdEnd(kind, createdAt);
  // A stay whose age is unknown is not payable yet: on doubt we don't take money (P8).
  const holdUnknown = kind !== 'event' && createdAt === null;
  const email = entry?.guestEmail ?? booking.email;
  const { title, total, rowState, fromSelect } = booking;
  const rowSettled = rowState === 'paid' || rowState === 'cancelled';
  const canPay = !holdUnknown && !rowSettled && !(holdEndsAt !== null && now >= holdEndsAt);
  const recentAttempt = attemptAt !== null && isFreshPayment(attemptAt, now);

  const holdOver = useCallback(
    () => holdEndsAt !== null && clock.serverNow() >= holdEndsAt,
    [holdEndsAt],
  );

  // P8: the hold ends on the server clock; Pay turns into Start again.
  useEffect(() => {
    if (holdEndsAt !== null && now >= holdEndsAt) send({ type: 'holdExpired' });
  }, [now, holdEndsAt, send]);

  const openBrowser = useCallback(
    async (reference: string, url: string, paymentStartedAt: number) => {
      send({ type: 'opened', reference, paymentStartedAt });
      if (alive())
        setAttemptAt((a) => (a === null ? paymentStartedAt : Math.max(a, paymentStartedAt)));
      if (Platform.OS === 'android') {
        // The Custom Tab promise resolves 'opened' at once; coming back is the app turning active.
        appSub.current?.remove();
        appSub.current = AppState.addEventListener('change', (s) => {
          if (s !== 'active') return;
          appSub.current?.remove();
          appSub.current = null;
          send({ type: 'returned', now: clock.serverNow() });
        });
      }
      try {
        const res = await WebBrowser.openBrowserAsync(url, BROWSER_OPTIONS);
        if (Platform.OS !== 'android' && res.type !== WebBrowser.WebBrowserResultType.OPENED) {
          send({ type: 'returned', now: clock.serverNow() });
        }
      } catch {
        // Nothing opened, but a payment was started: check it rather than leave Pay stuck.
        appSub.current?.remove();
        appSub.current = null;
        send({ type: 'returned', now: clock.serverNow() });
      }
    },
    [send, alive],
  );

  const recordStart = useCallback(
    async (to: string, gen: number): Promise<CheckoutEntry> => {
      const onDisk = await checkoutStore.get(userId, kind, bookingId).catch(() => null);
      if (onDisk !== null) {
        await checkoutStore.markStarted(userId, kind, bookingId, gen).catch(() => undefined);
        return { ...onDisk, paymentEverStarted: true };
      }
      const minimal: CheckoutEntry = {
        userId,
        kind,
        bookingId,
        listingId: '',
        title: title ?? '',
        createdAt: createdAt ?? new Date(clock.serverNow()).toISOString(),
        total: total ?? 0,
        pricing: null,
        summary: {},
        guestEmail: to,
        payment: null,
        paymentEverStarted: true,
      };
      await checkoutStore.put(minimal, gen).catch(() => undefined);
      return minimal;
    },
    [userId, kind, bookingId, title, total, createdAt],
  );

  const initialize = useCallback(async () => {
    if (holdOver()) {
      send({ type: 'startFailed', words: HOLD_ENDED_WORDS, action: 'startAgain' });
      send({ type: 'holdExpired' });
      return;
    }
    const to = email;
    if (to === null || to === '') {
      send({ type: 'startFailed', words: START_FAILED_WORDS, action: 'tryAgain' });
      return;
    }
    // R8: the booking is on disk, marked started, before initialise is sent: its answer may be
    // lost while a payment exists. With no cached entry, a minimal one is written from the row.
    // A sign-out wipe during this work drops its writes (B1).
    const gen = checkoutStore.generation();
    sawPayment.current = true;
    setSawPay(true);
    const startedEntry = await recordStart(to, gen);
    entryRef.current = startedEntry;
    if (alive()) setEntry(startedEntry);
    if (!alive()) return;
    // Sent once: the client never re-sends it, and a lost answer is settled by check-status.
    const r = await initializePayment(api, kind, bookingId, to);
    if (!r.ok) {
      send({
        type: 'startFailed',
        words: startErrorWords(r.error),
        action: startErrorAction(r.error),
      });
      return;
    }
    const { reference, payment_url } = r.value.payment;
    const startedAt = clock.serverNow();
    const payment = { reference, paymentUrl: payment_url, startedAt };
    // P5: on disk before the browser opens. A failed write still opens: the server has the
    // reference, and check-status reuses it on the next Pay.
    await checkoutStore.setPayment(userId, kind, bookingId, payment, gen).catch(() => undefined);
    entryRef.current = { ...startedEntry, payment };
    if (!alive()) return;
    setEntry(entryRef.current);
    // B3: only Paystack's own pages open. The reference is kept; check-status settles it.
    if (!isPaymentUrl(payment_url)) {
      send({ type: 'startFailed', words: START_FAILED_WORDS, action: 'tryAgain' });
      return;
    }
    await openBrowser(reference, payment_url, startedAt);
  }, [holdOver, email, send, kind, bookingId, userId, openBrowser, alive, recordStart]);

  /** In `starting`: check-status, then the pay plan (P4, P26). Never initialises on doubt. */
  const start = useCallback(async () => {
    const c = await checkPayment(api, kind, bookingId);
    if (!alive()) return;
    if (!c.ok) {
      send({
        type: 'startFailed',
        words: startErrorWords(c.error),
        action: startErrorAction(c.error),
      });
      return;
    }
    const check = c.value;
    const stored = await checkoutStore
      .get(userId, kind, bookingId)
      .then((e) => e?.payment ?? null)
      .catch(() => null);
    if (!alive()) return;
    const plan = planPay(check, stored, clock.serverNow());
    if (plan.do !== 'initialize') {
      sawPayment.current = true;
      setSawPay(true);
    }
    switch (plan.do) {
      case 'check':
        send({
          type: 'paid',
          reference: plan.reference,
          paymentStartedAt: plan.paymentStartedAt,
          now: clock.serverNow(),
        });
        return;
      case 'open':
        await openBrowser(plan.reference, plan.url, plan.paymentStartedAt);
        return;
      case 'initialize':
        await initialize();
        return;
      case 'wait':
        // A reference under 15 min old with no URL here: never verified, never replaced (A1).
        send({ type: 'pendingElsewhere' });
        return;
      case 'verifyPending': {
        // Only references 15 min old or more reach verify (P26).
        const v = await verifyPayment(api, plan.reference);
        if (!alive()) return;
        const verdict: PayVerdict = v.ok ? fromVerified(v.value) : 'unknown';
        const createdAtIso = 'payment' in check ? check.payment.created_at : '';
        const next = afterPendingVerify(verdict, createdAtIso, clock.serverNow());
        if (next === 'done') {
          send({
            type: 'paid',
            reference: plan.reference,
            paymentStartedAt: Date.parse(createdAtIso),
            now: clock.serverNow(),
          });
        } else if (next === 'wait') send({ type: 'pendingElsewhere' });
        else await initialize();
        return;
      }
    }
  }, [kind, bookingId, userId, send, openBrowser, initialize, alive]);

  const pay = useCallback(() => {
    if (!PAYABLE.has(current.current.step)) return;
    if (holdUnknown || rowSettled) return;
    if (holdOver()) {
      send({ type: 'retry' });
      send({ type: 'holdExpired' });
      return;
    }
    send({ type: 'pay' });
    if (stepNow() !== 'starting') return;
    void start();
  }, [holdUnknown, rowSettled, holdOver, send, stepNow, start]);

  const retry = useCallback(() => {
    send({ type: 'retry' });
  }, [send]);

  const checkAgain = useCallback(() => {
    const step = current.current.step;
    if (step === 'stillChecking' || step === 'unconfirmed') {
      send({ type: 'checkAgain', now: clock.serverNow() });
      return;
    }
    if (step === 'startError') {
      pay();
      return;
    }
    if (step !== 'pendingElsewhere') return;
    if (holdOver()) {
      send({ type: 'retry' });
      send({ type: 'holdExpired' });
      return;
    }
    send({ type: 'checkAgain', now: clock.serverNow() });
    if (stepNow() === 'starting') void start();
  }, [send, stepNow, pay, holdOver, start]);

  const leave = useCallback(() => {
    // Only a booking made on Select in this session, never paid for: its entry is read and has
    // no payment, ever, and its row reads unpaid. Opened from Bookings or a link, or before the
    // read lands, nothing is cancelled.
    if (
      !cancelsOnLeave(
        fromSelect,
        rowState,
        current.current.step,
        sawPayment.current,
        entryLoaded.current,
        entryRef.current,
      )
    ) {
      return;
    }
    // A2a: the server must also say there is no payment, paid or pending. Any doubt keeps it.
    // P7: best effort; a lost cancel is freed by the server's sweep. Runs after the screen goes.
    void (async () => {
      const c = await checkPayment(api, kind, bookingId);
      if (!c.ok || c.value.hasPaid || c.value.hasPending) return;
      await cancelBooking(api, kind, bookingId).catch(() => undefined);
      await checkoutStore.drop(userId, kind, bookingId);
    })().catch(() => undefined);
  }, [fromSelect, rowState, kind, bookingId, userId]);

  // P6 (amended A1): status polls only, on the state's own schedule; the first 2 s after entry.
  useEffect(() => {
    if (state.step !== 'checking') return;
    let on = true;
    const { reference } = state;
    const timer = setTimeout(() => {
      void paymentState(api, reference).then((r) => {
        if (on) {
          send({
            type: 'verdict',
            verdict: r.ok ? fromPaymentState(r.value) : 'unknown',
            now: clock.serverNow(),
          });
        }
      });
    }, state.nextDelayMs);
    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [state, send]);

  // A settled payment: bookings, this booking and the tickets reload. Paid drops the entry; a
  // failed one keeps it, payment cleared, for Try again (R8). Either only while the entry still
  // holds this reference (A4).
  useEffect(() => {
    if (state.step !== 'done' && state.step !== 'failed') return;
    const { reference } = state;
    if (state.step === 'done') {
      void checkoutStore.drop(userId, kind, bookingId, reference).catch(() => undefined);
    } else {
      void checkoutStore.clearPayment(userId, kind, bookingId, reference).catch(() => undefined);
      const e = entryRef.current;
      if (e !== null && (e.payment === null || e.payment.reference === reference)) {
        entryRef.current = { ...e, payment: null };
        setEntry(entryRef.current);
      }
    }
    void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
    void qc.invalidateQueries({ queryKey: customerKeys.booking(userId, kind, bookingId) });
    void qc.invalidateQueries({ queryKey: customerKeys.wallet(userId) });
  }, [state, userId, kind, bookingId, qc]);

  const willCancelOnLeave = cancelsOnLeave(fromSelect, rowState, state.step, sawPay, loaded, entry);

  return {
    state,
    pay,
    retry,
    checkAgain,
    leave,
    willCancelOnLeave,
    holdEndsAt,
    canPay,
    recentAttempt,
    entry,
  };
}
