import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';

import type { RfqKind, RfqRow } from '@/features/customer/hooks/rfqKinds';
import { useRfqActions, useRfqReview } from '@/features/customer/hooks/useCarActions';
import { usePayOnOpen, useRfqPayment } from '@/features/customer/hooks/useCarPayment';
import { useRfqRequest } from '@/features/customer/hooks/useCarRequests';
import { useFocusRefetch } from '@/features/customer/hooks/useFocusRefetch';
import { useServiceCharge } from '@/features/customer/hooks/useCheckoutData';
import { chargeEstimate, payableTotal } from '@/features/customer/domain/checkout/reviewText';
import { CAR_TRY_AGAIN, carRefusedWords } from '@/features/customer/ui/car/carActionWords';
import { formatNaira } from '@/shared/lib/formatNaira';

const SUPPORT = 'support@bookhushly.com';

/**
 * One request-for-quote (car rental, logistics) on its own screen: the request, its actions and
 * payment, with the money rules in one place.
 * - "Choose and pay" opens the checkout once, from an in-app flag (never a link).
 * - Cancel waits while a payment may be under way, and asks the server first when a quote is
 *   chosen (a payment started anywhere may still land); the refund outcome is said plainly.
 * - A lost answer is "try again", never a refusal.
 */
export function useRequestScreen<R extends RfqRow, B>(
  kind: RfqKind<R, B>,
  userId: string,
  id: string,
) {
  const q = useRfqRequest(kind, userId, id);
  useFocusRefetch(useIsFocused(), q);
  const r = q.request;
  const actions = useRfqActions(kind, userId, id);
  const review = useRfqReview(kind, userId, id);
  const pay = useRfqPayment(kind, userId, id, r?.status === 'matched');
  // What Pay shows: the quote plus the service charge estimate (initialise computes the real one,
  // web `calculateServiceCharge`). Unknown charge: the quote alone, and the page says so.
  const charge = useServiceCharge(kind.requestType);
  const quote = r?.selectedOffer?.amount ?? null;
  const est =
    quote === null || charge.data === undefined ? null : chargeEstimate(quote, charge.data);
  const payTotal =
    quote === null ? null : charge.data === undefined ? quote : payableTotal(quote, est);
  const payNote =
    quote === null
      ? null
      : charge.data === undefined
        ? 'The payment page shows the final amount, with any service charge.'
        : est === null
          ? null
          : `Includes a ${est.label.toLowerCase()} of ${formatNaira(est.amount)}.`;
  const [cancelling, setCancelling] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The open-payment check before a cancel: one at a time, and the sheet shows it working.
  const cancelChecking = useRef(false);
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Subscribed to the flag itself: it is set after the request already reads matched (the screen
  // underneath has refreshed), so the effect must re-run when the flag arrives.
  const asked = usePayOnOpen((s) => s.id === id);
  const takePayOnOpen = usePayOnOpen((s) => s.take);
  const matched = r?.status === 'matched';
  const startPay = pay.pay;
  useEffect(() => {
    if (asked && matched && takePayOnOpen(id)) startPay();
  }, [asked, matched, id, takePayOnOpen, startPay]);

  const confirmDone = async () => {
    setProblem(null);
    const out = await actions.confirmDone();
    if (out.kind === 'tryAgain') setProblem(CAR_TRY_AGAIN);
    else if (out.kind === 'refused') setProblem(carRefusedWords(out.code));
  };

  const cancel = async (reason: string) => {
    if (cancelChecking.current || r === null) return;
    setProblem(null);
    // A payment started anywhere (the web, another phone) may still land: never cancel over it.
    if (r.status === 'matched') {
      cancelChecking.current = true;
      setChecking(true);
      const open = await pay.paymentOpen().finally(() => {
        cancelChecking.current = false;
        setChecking(false);
      });
      if (open !== 'clear') {
        setProblem(
          open === 'open'
            ? 'A payment for this is still being processed. Wait until it finishes, then check again.'
            : CAR_TRY_AGAIN,
        );
        return;
      }
    }
    const out = await actions.cancel(reason);
    if (out.kind === 'ok') {
      setCancelling(false);
      setNotice(
        out.value.refund === 'pending'
          ? 'Cancelled. A refund has been started.'
          : out.value.refund === 'none'
            ? 'Cancelled. Nothing was charged.'
            : 'Cancelled. If you had paid, a refund was started.',
      );
    } else if (out.kind === 'tryAgain') setProblem(CAR_TRY_AGAIN);
    else if (out.kind === 'refused') setProblem(carRefusedWords(out.code));
  };

  /** `label` names it in the email: "Car rental", "Moving". */
  const reportProblem = (label: string) => {
    const subject = encodeURIComponent(`${label} ${id}`);
    Linking.openURL(`mailto:${SUPPORT}?subject=${subject}`).catch(() => {
      // No mail app (common on iPads): say where to write instead of doing nothing.
      Alert.alert('Report a problem', `Email ${SUPPORT} and mention ${label.toLowerCase()} ${id}.`);
    });
  };

  // While a payment may be under way, cancelling could leave money taken on a cancelled request
  // (the web's verify/webhook would still mark it paid): Cancel waits for the payment to settle.
  const payOpen =
    pay.state.kind === 'starting' ||
    pay.state.kind === 'inBrowser' ||
    pay.state.kind === 'checking' ||
    pay.state.kind === 'notYet' ||
    pay.state.kind === 'paid';

  const refresh = () => {
    setRefreshing(true);
    void q.refetch().finally(() => {
      setRefreshing(false);
    });
  };

  return {
    q,
    r,
    actions,
    review,
    pay,
    payTotal,
    payNote,
    payOpen,
    problem,
    clearProblem: () => {
      setProblem(null);
    },
    notice,
    clearNotice: () => {
      setNotice(null);
    },
    cancelling,
    openCancel: () => {
      setProblem(null);
      setCancelling(true);
    },
    closeCancel: () => {
      setCancelling(false);
    },
    cancelBusy: actions.busy === 'cancel' || checking,
    cancel,
    confirmDone,
    reviewing,
    setReviewing,
    reportProblem,
    refreshing,
    refresh,
  };
}
