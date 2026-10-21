import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

import type { FlowState } from '@/features/customer/domain/checkout/paymentFlow';
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
import { usePayment, type PayKind } from '@/features/customer/hooks/usePayment';
import { checkoutStore } from '@/features/customer/offline/checkoutStore';
import { NoticeScreen } from '@/features/customer/screens/NoticeScreen';
import { BookedDone } from '@/features/customer/ui/checkout/BookedDone';
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
  userId: string;
  /** The signed-in email: the receipt address when no checkout entry is cached. */
  email: string;
  onBack: () => void;
  onBookings: () => void;
  onStartAgain: (to: StartAgain | null) => void;
  onViewTickets: (bookingId: string) => void;
  onViewBooking: (kind: PayKind, bookingId: string) => void;
  onDone: () => void;
};

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
  userId,
  email,
  onBack,
  onBookings,
  onStartAgain,
  onViewTickets,
  onViewBooking,
  onDone,
}: Props & { booking: { kind: PayKind; id: string } }) {
  const qc = useQueryClient();
  const navigation = useNavigation();
  const b = useBooking(userId, kind, id);
  const row = b.row;
  const pre = reviewSummary(kind, null, row, b.today);
  const p = usePayment(userId, kind, id, {
    createdAt: row?.created_at ?? null,
    email: email === '' ? null : email,
    title: pre.title,
    ...(typeof row?.total_amount === 'number' ? { total: row.total_amount } : {}),
  });
  const { leave } = p;
  const chargeQ = useServiceCharge(kind);
  const step = p.state.step;
  // Free events land here registered (web /free writes 'completed'). `?free=1` is only a hint:
  // Done waits for the row to say paid, and anything else is reviewed like any booking.
  const freeEvent = free && kind === 'event';
  const freeDone = freeEvent && row?.payment_status === 'completed';
  /** Cancel booking already ran leave(): the removal that follows must not run it again. */
  const left = useRef(false);

  // P7: back, swipe or close from Review cancels an unpaid hold (the hook skips it once a
  // payment started). Nothing leaves while a payment is being started or checked.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (BUSY.has(step)) {
          e.preventDefault();
          return;
        }
        if (freeDone || left.current) return;
        leave();
      }),
    [navigation, step, freeDone, leave],
  );

  useEffect(() => {
    if (!BUSY.has(step)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      sub.remove();
    };
  }, [step]);

  // A free registration has no payment to settle: drop its entry (or Bookings reads it as being
  // checked, P21) and reload bookings and tickets (P20).
  useEffect(() => {
    if (!freeDone) return;
    void checkoutStore.drop(userId, kind, id).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
    void qc.invalidateQueries({ queryKey: customerKeys.booking(userId, kind, id) });
    void qc.invalidateQueries({ queryKey: customerKeys.wallet(userId) });
  }, [freeDone, userId, kind, id, qc]);

  const entry = p.entry;
  const summary = reviewSummary(kind, entry, row, b.today);
  const guestEmail = entry?.guestEmail ?? email;
  const startAgain = () => {
    onStartAgain(startAgainTarget(kind, entry, row));
  };

  if (step === 'done' || freeDone) {
    return (
      <BookedDone
        isEvent={kind === 'event'}
        title={summary.title}
        when={summary.when}
        email={guestEmail}
        onView={() => {
          if (kind === 'event') onViewTickets(id);
          else onViewBooking(kind, id);
        }}
        onDone={onDone}
      />
    );
  }
  if (
    step === 'checking' ||
    step === 'failed' ||
    step === 'stillChecking' ||
    step === 'holdEnded' ||
    step === 'pendingElsewhere'
  ) {
    return (
      <PayStates
        state={step}
        onTryAgain={p.pay}
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
      starting={BUSY.has(step)}
      // The label must carry the charge: Pay waits for the estimate (or its failure).
      canPay={p.canPay && !chargeQ.isPending}
      chargeUnknown={chargeQ.isError}
      payInApp={CHECKOUT_PAYMENTS_ENABLED}
      startError={
        failure === null
          ? null
          : {
              words: failure.words,
              action:
                failure.action === 'startAgain'
                  ? { label: 'Start again', onPress: startAgain }
                  : failure.action === 'tryAgain'
                    ? { label: 'Try again', onPress: p.checkAgain }
                    : null,
            }
      }
      onPay={p.pay}
      // P7: only a booking leaving would cancel is offered as Cancel booking; else Not now.
      onCancel={
        p.willCancelOnLeave
          ? () => {
              left.current = true;
              leave();
              onBack();
            }
          : null
      }
      onBack={onBack}
    />
  );
}
