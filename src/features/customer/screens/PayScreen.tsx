import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import { rowPayState, type FlowState } from '@/features/customer/domain/checkout/paymentFlow';
import type { StartErrorAction } from '@/features/customer/domain/checkout/paymentStatus';
import {
  chargeEstimate,
  priceLines,
  reviewSummary,
  startAgainTarget,
  type StartAgain,
} from '@/features/customer/domain/checkout/reviewText';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { useBooking } from '@/features/customer/hooks/useBooking';
import { useServiceCharge } from '@/features/customer/hooks/useCheckoutData';
import { sentNotice } from '@/features/customer/hooks/sentNotice';
import { usePayment, type ReviewCancel, type PayKind } from '@/features/customer/hooks/usePayment';
import { checkoutStore } from '@/features/customer/offline/checkoutStore';
import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';
import { BookedDone } from '@/features/customer/ui/checkout/BookedDone';
import type { CrossSellItem } from '@/features/customer/domain/trips/trips';
import { TripCrossSell } from '@/features/customer/ui/trips/TripCrossSell';
import { PayReview } from '@/features/customer/ui/checkout/PayReview';
import { PayStates } from '@/features/customer/ui/checkout/PayStates';
import { CHECKOUT_PAYMENTS_ENABLED } from '@/shared/config/features';
import { lagosClock12 } from '@/shared/lib/lagosDay';
import { ErrorState, Header, Screen, SkeletonRows } from '@/shared/ui';

type Props = {
  /** Null when the route params are off-shape. */
  booking: { kind: PayKind; id: string } | null;
  /** `?free=1`: a free event registered on Select; Done directly (P1). */
  free: boolean;
  /** `?from=select`: reached straight from Select in this session; only then may leaving cancel (A2a). */
  fromSelect: boolean;
  userId: string;
  /** The signed-in email: the receipt address when no checkout entry is cached. */
  email: string;
  onBack: () => void;
  onBookings: () => void;
  onStartAgain: (to: StartAgain | null) => void;
  onViewTickets: (bookingId: string) => void;
  onViewBooking: (kind: PayKind, bookingId: string) => void;
  onDone: () => void;
  /** The trip suggestions after a booking: book another kind, or open or plan a trip. */
  onCrossSell: (item: CrossSellItem) => void;
  onTrip: (tripId: string | null) => void;
};

/**
 * The button beside a start error (P14, W1). Try again and Check again both re-run Pay, which asks
 * check-status first; an already-paid booking and a refusal have none.
 */
function startErrorButton(
  action: StartErrorAction,
  startAgain: () => void,
  checkAgain: () => void,
): { label: string; onPress: () => void } | null {
  switch (action) {
    case 'startAgain':
      return { label: 'Start again', onPress: startAgain };
    case 'tryAgain':
      return { label: 'Try again', onPress: checkAgain };
    case 'checkAgain':
      return { label: 'Check again', onPress: checkAgain };
    case 'paid':
    case null:
      return null;
  }
}

/** Why Cancel booking didn't cancel (G1). Never a refusal for a lost answer. */
const CANCEL_WORDS: Record<Exclude<ReviewCancel, 'cancelled'>, string> = {
  paymentInProgress: 'This booking has a payment in progress, so it wasn’t cancelled.',
  refused: 'This booking can’t be cancelled now.',
  notDone: 'Couldn’t cancel — check your connection and try again',
};

/** G5: web's free route can answer before the tickets exist. */
const TICKETS_PREPARING = 'Your tickets are being prepared — they’ll appear in Bookings shortly';
const TICKETS_RECHECK_MS = 5000;

/** Leaving is blocked: a payment is being started or checked (P6). */
const BUSY: ReadonlySet<FlowState['step']> = new Set(['starting', 'inBrowser', 'checking']);

// Spec P1, P22: Review → Checking → Done as one screen over one payment state machine.
export function PayScreen(props: Props) {
  if (props.booking === null) {
    return (
      <NoticeScreen
        title="Payment"
        icon={ReceiptText}
        heading="Booking not found"
        onBack={props.onBack}
      />
    );
  }
  return <Pay {...props} booking={props.booking} />;
}

function Pay({
  booking: { kind, id },
  free,
  fromSelect,
  userId,
  email,
  onBack,
  onBookings,
  onStartAgain,
  onViewTickets,
  onViewBooking,
  onDone,
  onCrossSell,
  onTrip,
}: Props & { booking: { kind: PayKind; id: string } }) {
  const qc = useQueryClient();
  const navigation = useNavigation();
  const b = useBooking(userId, kind, id);
  const row = b.row;
  const pre = reviewSummary(kind, null, row, b.today);
  // A2: the row is server truth. Paid is Done; cancelled never pays; only unpaid may cancel.
  const rowState = rowPayState(kind, row);
  const p = usePayment(userId, kind, id, {
    createdAt: row?.created_at ?? null,
    email: email === '' ? null : email,
    title: pre.title,
    ...(typeof row?.total_amount === 'number' ? { total: row.total_amount } : {}),
    rowState,
    fromSelect,
  });
  const { leave } = p;
  const chargeQ = useServiceCharge(kind);
  const step = p.state.step;
  // Free events land here registered (web /free writes 'completed'). `?free=1` is only a hint:
  // Done waits for the row to say paid, and anything else is reviewed like any booking. A row
  // that already reads paid (paid elsewhere, or settled meanwhile) is Done the same way (A2b).
  const freeEvent = free && kind === 'event';
  const rowPaid = rowState === 'paid';
  /** Cancel booking is running or ran: the removal that follows must not cancel again. */
  const left = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // G4: a row that reads paid is Done at once, with its buttons and Back, even mid-Checking.
  const busy = BUSY.has(step) && !rowPaid;

  // P7: back, swipe or close from Review cancels an unpaid hold (the hook skips it once a
  // payment started). Nothing leaves while a payment is being started or checked.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        // A free registration is never cancelled from here, loaded or not.
        if (freeEvent || left.current) return;
        leave();
      }),
    [navigation, busy, freeEvent, leave],
  );

  useEffect(() => {
    if (!busy) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      sub.remove();
    };
  }, [busy]);

  // G5: an event Done whose booking has no tickets yet is read again once, 5 s later.
  const done = step === 'done' || rowPaid;
  const noTicketsYet =
    kind === 'event' &&
    row != null &&
    'tickets' in row &&
    (row.tickets === null || row.tickets.length === 0);
  const ticketsPreparing = done && noTicketsYet;
  const refetchRow = useRef(b.refetch);
  useEffect(() => {
    refetchRow.current = b.refetch;
  });
  const rechecked = useRef(false);
  useEffect(() => {
    if (!ticketsPreparing || rechecked.current) return;
    const t = setTimeout(() => {
      rechecked.current = true;
      void refetchRow.current();
    }, TICKETS_RECHECK_MS);
    return () => {
      clearTimeout(t);
    };
  }, [ticketsPreparing]);

  // A paid row (a free registration included) has no payment left to settle: drop its entry (or
  // Bookings reads it as being checked, P21) and reload bookings and tickets (P20).
  useEffect(() => {
    if (!rowPaid) return;
    void checkoutStore.drop(userId, kind, id).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
    void qc.invalidateQueries({ queryKey: customerKeys.booking(userId, kind, id) });
    void qc.invalidateQueries({ queryKey: customerKeys.wallet(userId) });
  }, [rowPaid, userId, kind, id, qc]);

  const entry = p.entry;
  const summary = reviewSummary(kind, entry, row, b.today);
  const guestEmail = entry?.guestEmail ?? email;
  const startAgain = () => {
    onStartAgain(startAgainTarget(kind, entry, row));
  };

  if (done) {
    return (
      <BookedDone
        isEvent={kind === 'event'}
        title={summary.title}
        when={summary.when}
        note={ticketsPreparing ? TICKETS_PREPARING : null}
        email={guestEmail}
        onView={() => {
          if (kind === 'event') onViewTickets(id);
          else onViewBooking(kind, id);
        }}
        onDone={onDone}
        extra={
          <TripCrossSell userId={userId} justBooked={kind} onBook={onCrossSell} onTrip={onTrip} />
        }
      />
    );
  }
  // A2b: a cancelled booking is never paid for. Nothing is interrupted while a payment is busy.
  if (rowState === 'cancelled' && !busy) {
    return (
      <PayStates
        state="cancelled"
        onTryAgain={p.retry}
        onCheckAgain={p.checkAgain}
        onBookings={onBookings}
        onStartAgain={startAgain}
        onBack={onBack}
      />
    );
  }
  if (
    step === 'checking' ||
    step === 'failed' ||
    step === 'unconfirmed' ||
    step === 'stillChecking' ||
    step === 'holdEnded' ||
    step === 'pendingElsewhere'
  ) {
    return (
      <PayStates
        state={step}
        onTryAgain={p.retry}
        onCheckAgain={p.checkAgain}
        onBookings={onBookings}
        onStartAgain={startAgain}
        onBack={onBack}
      />
    );
  }

  const total = entry?.total ?? (typeof row?.total_amount === 'number' ? row.total_amount : null);
  if (total === null || (freeEvent && row === undefined)) {
    if (row === null) {
      return (
        <NoticeScreen
          title="Payment"
          icon={ReceiptText}
          heading="Booking not found"
          onBack={onBack}
        />
      );
    }
    return (
      <Screen header={<Header title="Review and pay" />}>
        {b.error ? (
          <ErrorState
            title="Couldn’t load this booking"
            message="Check your connection and try again."
            onRetry={() => {
              void b.refetch();
            }}
          />
        ) : (
          <SkeletonRows count={4} />
        )}
      </Screen>
    );
  }

  const failure = p.state.step === 'startError' ? p.state : null;
  const charge = chargeEstimate(total, chargeQ.data ?? null);
  return (
    <PayReview
      summary={summary}
      email={guestEmail}
      price={priceLines(kind, entry?.pricing ?? null)}
      total={total}
      charge={charge}
      // Events have no hold (P8), whatever the hook says.
      holdUntil={
        kind === 'event' || p.holdEndsAt === null
          ? null
          : lagosClock12(new Date(p.holdEndsAt).toISOString())
      }
      starting={busy}
      // The label must carry the charge: Pay waits for the estimate (or its failure).
      canPay={p.canPay && !chargeQ.isPending && !cancelling}
      chargeUnknown={chargeQ.isError}
      // Offline (paused) or retrying after a failure: say why Pay is waiting.
      chargeChecking={
        chargeQ.fetchStatus === 'paused' || (chargeQ.isPending && chargeQ.failureCount > 0)
      }
      payInApp={CHECKOUT_PAYMENTS_ENABLED}
      providerPending={p.providerPending}
      startError={
        failure === null
          ? null
          : {
              words: failure.words,
              action: startErrorButton(failure.action, startAgain, p.checkAgain),
            }
      }
      onPay={p.pay}
      // P7: only a booking leaving would cancel is offered as Cancel booking; else Not now.
      // G1: the checks and the cancel run here, with a spinner; back and swipe stay silent.
      onCancel={
        p.willCancelOnLeave || cancelling
          ? () => {
              if (cancelling) return;
              left.current = true;
              setCancelling(true);
              setCancelError(null);
              void p.cancelNow().then((r) => {
                setCancelling(false);
                if (r === 'cancelled') {
                  sentNotice.note(userId, 'Booking cancelled');
                  onBookings();
                  return;
                }
                left.current = false;
                setCancelError(CANCEL_WORDS[r]);
              });
            }
          : null
      }
      cancelling={cancelling}
      cancelError={cancelError}
      onBack={onBack}
    />
  );
}
