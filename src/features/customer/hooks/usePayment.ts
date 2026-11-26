import { useQueryClient } from '@tanstack/react-query';
import { refreshTrips } from '@/features/customer/hooks/useTrips';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type NativeEventSubscription } from 'react-native';

import { cancelBooking } from '@/features/customer/api/bookingActionsApi';
import { cancelOutcome } from '@/features/customer/domain/actionOutcome';
import {
  checkPayment,
  initializePayment,
  paymentState,
  verifyPayment,
} from '@/features/customer/api/checkoutApi';
import {
  acceptReuse,
  afterPendingVerify,
  flow,
  holdEndsAt as holdEnd,
  isPaymentUrl,
  planPay,
  type FlowEvent,
  type FlowState,
  type RowPayState,
} from '@/features/customer/domain/checkout/paymentFlow';
import {
  fromPaymentState,
  fromVerified,
  isDefinitiveFailure,
  providerStillProcessing,
  startErrorAction,
  startErrorWords,
  type PayVerdict,
} from '@/features/customer/domain/checkout/paymentStatus';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { holdPayScreen } from '@/features/customer/hooks/openPayScreens';
import { useServerNow } from '@/features/customer/hooks/useServerNow';
import { checkoutStore, type CheckoutEntry } from '@/features/customer/offline/checkoutStore';
import { api, clock } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';

// Spec P4–P8, P26, P29 (amended 4c.1). Money rules: one initialise per tap, only after
// check-status says there is no reusable reference; the reference is on disk before the browser
// opens; Done only from a fulfilled status poll; a hold past 25 min on the server clock never
// initialises. On return verify runs once, then status is polled; a failure is final only when
// Paystack says `failed`/`reversed` (V1).

export type PayKind = 'hotel' | 'apartment' | 'event';

/**
 * What an explicit Cancel booking did (G1): cancelled; kept because a payment is (or may be) in
 * progress; refused by the server; or not done because an answer was lost (network, 5xx, 429).
 */
export type ReviewCancel = 'cancelled' | 'paymentInProgress' | 'refused' | 'notDone';

export const BROWSER_OPTIONS = { createTask: false, showInRecents: false } as const;

const HOLD_ENDED_WORDS = 'This hold has ended. Start again';
const START_FAILED_WORDS = 'Couldn’t start payment. Try again';

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
  /** Cancel booking on Review (G1): the same checks as leave(), awaited, with the answer. */
  cancelNow: () => Promise<ReviewCancel>;
  /** leave() would cancel the booking now (P7): Review offers Cancel booking only then. */
  willCancelOnLeave: boolean;
  /** Stays: when Pay stops (epoch ms, server clock). Null for events, or while unknown. */
  holdEndsAt: number | null;
  /** Pay can start: the stay's age is known, its hold hasn't ended, the row isn't paid or cancelled. */
  canPay: boolean;
  /** The latest verify for this booking says Paystack is still clearing it: Review warns (V4). */
  providerPending: boolean;
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
  /** Paystack's status from the latest verify for this booking, if any (V4). */
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
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
  const providerPending = providerStillProcessing(providerStatus);

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
    [send],
  );

  /** One verify; its Paystack status feeds the Review warning (V4). Unknown on any failure. */
  const verifyOnce = useCallback(
    async (
      reference: string,
    ): Promise<{ verdict: PayVerdict; definitive: boolean; provider: string | null }> => {
      const v = await verifyPayment(api, reference);
      if (!v.ok) return { verdict: 'unknown', definitive: false, provider: null };
      const provider = v.value.provider_status ?? null;
      if (alive()) setProviderStatus(provider);
      return { verdict: fromVerified(v.value), definitive: isDefinitiveFailure(v.value), provider };
    },
    [alive],
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

  /**
   * A failed initialise (P14, W1). 409 `already_paid` is never retried: the booking row is
   * reloaded (a paid row is Done) and check-status names the paid reference for Checking.
   */
  const startFailed = useCallback(
    async (e: ApiError) => {
      const words = startErrorWords(e);
      const action = startErrorAction(e);
      if (action !== 'paid') {
        send({ type: 'startFailed', words, action });
        return;
      }
      void qc.invalidateQueries({ queryKey: customerKeys.booking(userId, kind, bookingId) });
      const c = await checkPayment(api, kind, bookingId);
      if (!alive()) return;
      if (c.ok && c.value.hasPaid) {
        send({
          type: 'paid',
          reference: c.value.payment.reference,
          paymentStartedAt: Date.parse(c.value.payment.created_at),
          now: clock.serverNow(),
        });
        return;
      }
      send({ type: 'startFailed', words, action });
    },
    [send, qc, userId, kind, bookingId, alive],
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
      await startFailed(r.error);
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
  }, [
    holdOver,
    email,
    send,
    kind,
    bookingId,
    userId,
    openBrowser,
    alive,
    recordStart,
    startFailed,
  ]);

  /**
   * V3: a pending reference under 30 min old with no URL here. Initialise, signed in and without
   * `email`, hands back that same checkout when web can reuse it; anything else is never opened
   * (pendingElsewhere). The reference is on disk before the browser opens (P5).
   */
  const reuse = useCallback(
    async (reference: string, paymentStartedAt: number) => {
      const gen = checkoutStore.generation();
      const startedEntry = await recordStart(email ?? '', gen);
      entryRef.current = startedEntry;
      if (!alive()) return;
      setEntry(startedEntry);
      const r = await initializePayment(api, kind, bookingId);
      if (!alive()) return;
      if (!r.ok) {
        const action = startErrorAction(r.error);
        if (action === 'paid' || action === 'startAgain') await startFailed(r.error);
        else send({ type: 'pendingElsewhere' });
        return;
      }
      const url = r.value.payment.payment_url;
      if (!acceptReuse(r.value, reference) || !isPaymentUrl(url)) {
        send({ type: 'pendingElsewhere' });
        return;
      }
      const startedAt = Number.isFinite(paymentStartedAt) ? paymentStartedAt : clock.serverNow();
      const payment = { reference, paymentUrl: url, startedAt };
      await checkoutStore.setPayment(userId, kind, bookingId, payment, gen).catch(() => undefined);
      entryRef.current = { ...startedEntry, payment };
      if (!alive()) return;
      setEntry(entryRef.current);
      await openBrowser(reference, url, startedAt);
    },
    [recordStart, email, alive, kind, bookingId, startFailed, send, userId, openBrowser],
  );

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
      case 'reuse':
        await reuse(plan.reference, plan.paymentStartedAt);
        return;
      case 'verifyPending': {
        // P26, V2: a reference 30 min old or more (or of unknown age) with no URL here.
        const v = await verifyOnce(plan.reference);
        if (!alive()) return;
        const createdAtIso = 'payment' in check ? check.payment.created_at : '';
        const next = afterPendingVerify(v.verdict, v.provider, createdAtIso, clock.serverNow());
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
  }, [kind, bookingId, userId, send, openBrowser, initialize, alive, reuse, verifyOnce]);

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

  const cancelNow = useCallback(async (): Promise<ReviewCancel> => {
    const checks = () =>
      cancelsOnLeave(
        fromSelect,
        rowState,
        current.current.step,
        sawPayment.current,
        entryLoaded.current,
        entryRef.current,
      );
    if (!checks()) return 'paymentInProgress';
    // A2a, awaited this time: the server must say there is no payment, paid or pending.
    const c = await checkPayment(api, kind, bookingId);
    if (!c.ok) return 'notDone';
    if (c.value.hasPaid || c.value.hasPending) {
      // A payment exists: from now on leaving never cancels, and Review offers Not now.
      sawPayment.current = true;
      if (alive()) setSawPay(true);
      return 'paymentInProgress';
    }
    // Pay may have been tapped while check-status was out.
    if (!checks()) return 'paymentInProgress';
    const o = cancelOutcome(await cancelBooking(api, kind, bookingId));
    // A lost cancel may have landed: the row is re-read either way.
    void qc.invalidateQueries({ queryKey: customerKeys.booking(userId, kind, bookingId) });
    switch (o.kind) {
      case 'done':
        await checkoutStore.drop(userId, kind, bookingId).catch(() => undefined);
        void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
        refreshTrips(userId);
        return 'cancelled';
      case 'refused':
        return 'refused';
      case 'uncertain':
      case 'rateLimited':
      case 'signedOut':
        return 'notDone';
    }
  }, [fromSelect, rowState, kind, bookingId, userId, qc, alive]);

  // P6 (amended 4c.1 V1): verify once on entry, then status polls on the state's own schedule;
  // the first 2 s after verify answers.
  useEffect(() => {
    if (state.step !== 'checking') return;
    let on = true;
    const { reference } = state;
    if (state.verify) {
      void verifyOnce(reference).then((v) => {
        if (on) {
          send({
            type: 'verified',
            verdict: v.verdict,
            definitive: v.definitive,
            now: clock.serverNow(),
          });
        }
      });
      return () => {
        on = false;
      };
    }
    const timer = setTimeout(() => {
      void paymentState(api, reference).then((r) => {
        if (!on) return;
        // W4: a 503 `fetch_failed` is unknown, never failed; its Retry-After delays the next poll.
        const wait = !r.ok && r.error.kind === 'unavailable' ? r.error.retryAfterSec : undefined;
        send({
          type: 'verdict',
          verdict: r.ok ? fromPaymentState(r.value) : 'unknown',
          now: clock.serverNow(),
          ...(wait !== undefined ? { retryAfterMs: wait * 1000 } : {}),
        });
      });
    }, state.nextDelayMs);
    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [state, send, verifyOnce]);

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
    refreshTrips(userId);
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
    cancelNow,
    willCancelOnLeave,
    holdEndsAt,
    canPay,
    providerPending,
    entry,
  };
}
