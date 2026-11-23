import { useIsFocused } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Linking, RefreshControl, View } from 'react-native';

import {
  askAgainDraft,
  type AskAgainChange,
} from '@/features/customer/domain/carRental/carRequest';
import {
  canCancel,
  isPaidStatus,
  pendingQuotes,
  requestStage,
} from '@/features/customer/domain/carRental/carStatus';
import { useCarActions, useCarReview } from '@/features/customer/hooks/useCarActions';
import { useCarDraft } from '@/features/customer/hooks/useCarDraft';
import {
  useCarPayment,
  usePayOnOpen,
  type CarPayState,
} from '@/features/customer/hooks/useCarPayment';
import { useCarRequest } from '@/features/customer/hooks/useCarRequests';
import { useFocusRefetch } from '@/features/customer/hooks/useFocusRefetch';
import { ReviewSheet } from '@/features/customer/ui/ReviewSheet';
import { BookedView } from '@/features/customer/ui/car/BookedView';
import { CarCancelSheet } from '@/features/customer/ui/car/CarCancelSheet';
import { RequestLoadError } from '@/features/customer/ui/car/RequestLoadError';
import { StatusView } from '@/features/customer/ui/car/StatusView';
import { CAR_TRY_AGAIN, carRefusedWords } from '@/features/customer/ui/car/carActionWords';
import { carName, dateRange } from '@/features/customer/ui/car/carWords';
import { clock } from '@/shared/api/instance';
import { formatNaira } from '@/shared/lib/formatNaira';
import { lagosToday, longDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import {
  Banner,
  Button,
  Header,
  IconButton,
  refreshColors,
  Screen,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  userId: string;
  id: string;
  onBack: () => void;
  onSeeQuotes: () => void;
  /** "Ask again": the flow, already filled in. */
  onAskAgain: () => void;
};

const SUPPORT = 'support@bookhushly.com';

const PAY_WORDS: Partial<Record<CarPayState['kind'], string>> = {
  checking: 'Checking your payment…',
  notYet:
    'Your payment isn’t confirmed yet. Don’t pay again: this page updates when it is. Check again in a minute.',
  failed: 'The payment didn’t go through and you weren’t charged. You can try again.',
};

export function CarRequestScreen({ userId, id, onBack, onSeeQuotes, onAskAgain }: Props) {
  const q = useCarRequest(userId, id);
  useFocusRefetch(useIsFocused(), q);
  const r = q.request;
  const actions = useCarActions(userId, id);
  const review = useCarReview(userId, id);
  const startDraft = useCarDraft((s) => s.start);
  const pay = useCarPayment(userId, id, r?.status === 'matched');
  const [change, setChange] = useState<AskAgainChange | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The open-payment check before a cancel: one at a time, and the sheet shows it working.
  const cancelChecking = useRef(false);
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const today = lagosToday(clock.serverNow());

  // Straight from "Choose and pay" (an in-app flag, never a link): open the checkout once the
  // request reads matched.
  // Subscribed to the flag itself: it is set after the request already reads matched (the screen
  // underneath has refreshed), so the effect must re-run when the flag arrives.
  const asked = usePayOnOpen((s) => s.id === id);
  const takePayOnOpen = usePayOnOpen((s) => s.take);
  const matched = r?.status === 'matched';
  const startPay = pay.pay;
  useEffect(() => {
    if (asked && matched && takePayOnOpen(id)) startPay();
  }, [asked, matched, id, takePayOnOpen, startPay]);

  const header = (
    <Header
      title="Car rental"
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );

  if (r === null) {
    let body: ReactNode;
    if (q.loading) body = <SkeletonRows count={5} />;
    else
      body = (
        <RequestLoadError error={q.error} what="this request" onRetry={() => void q.refetch()} />
      );
    return <Screen header={header}>{body}</Screen>;
  }

  const stage = requestStage(r, clock.serverNow());
  const quotes = pendingQuotes(r.offers);
  const paid = isPaidStatus(r.status);
  const cancellable = canCancel(r.status);

  const doConfirm = async () => {
    setProblem(null);
    const out = await actions.confirmDone();
    if (out.kind === 'tryAgain') setProblem(CAR_TRY_AGAIN);
    else if (out.kind === 'refused') setProblem(carRefusedWords(out.code));
  };
  const doCancel = async (reason: string) => {
    if (cancelChecking.current) return;
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
          ? 'Cancelled. A refund of your payment has been started.'
          : out.value.refund === 'none'
            ? 'Cancelled. Nothing was charged.'
            : 'Cancelled. If you had paid, a refund was started.',
      );
    } else if (out.kind === 'tryAgain') setProblem(CAR_TRY_AGAIN);
    else if (out.kind === 'refused') setProblem(carRefusedWords(out.code));
  };
  const reportProblem = () => {
    const subject = encodeURIComponent(`Car rental ${r.id}`);
    Linking.openURL(`mailto:${SUPPORT}?subject=${subject}`).catch(() => {
      // No mail app (common on iPads): say where to write instead of doing nothing.
      Alert.alert('Report a problem', `Email ${SUPPORT} and mention car rental ${r.id}.`);
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

  const cancelLink =
    cancellable && !payOpen ? (
      <Button
        label={paid ? 'Cancel booking' : 'Cancel request'}
        variant="ghost"
        onPress={() => {
          setProblem(null);
          setCancelling(true);
        }}
        testID="car-cancel"
      />
    ) : null;

  let footer: ReactNode = null;
  let after: ReactNode = null;
  switch (stage) {
    case 'waiting':
      footer = cancelLink;
      break;
    case 'quotes':
      footer = (
        <Button
          label={quotes.length === 1 ? 'See the quote' : `See ${String(quotes.length)} quotes`}
          onPress={onSeeQuotes}
          testID="car-see-quotes"
        />
      );
      break;
    case 'noQuotes':
      footer = (
        <Button
          label="Ask again"
          onPress={() => {
            const next = askAgainDraft(r, change, today);
            // Dates cleared (asked for, or already past): the When step asks for new ones.
            startDraft(next, next.pickupDate === null ? 'when' : 'check');
            onAskAgain();
          }}
          testID="car-ask-again"
        />
      );
      break;
    case 'chosen': {
      const amount = r.selectedOffer?.amount ?? null;
      const words = pay.state.kind === 'error' ? pay.state.words : PAY_WORDS[pay.state.kind];
      footer = (
        <View style={{ gap: space.s3 }}>
          {words === undefined ? null : <Banner tone="neutral" message={words} />}
          {pay.state.kind === 'notYet' ? (
            <Button
              label="Check again"
              variant="secondary"
              onPress={pay.checkAgain}
              testID="car-check-again"
            />
          ) : (
            <Button
              label={amount === null ? 'Pay' : `Pay ${formatNaira(amount)}`}
              loading={
                pay.state.kind === 'starting' ||
                pay.state.kind === 'inBrowser' ||
                pay.state.kind === 'checking'
              }
              disabled={pay.state.kind === 'paid'}
              onPress={pay.pay}
              testID="car-pay"
            />
          )}
          {cancelLink}
        </View>
      );
      break;
    }
    case 'booked':
      footer = cancelLink;
      after = (
        <Text variant="bodySm" tone="textSecondary">
          {`After the trip, confirm it’s done so ${r.selectedVendor?.name ?? 'the company'} is paid. Until then your money stays held.`}
        </Text>
      );
      break;
    case 'onTrip': {
      const ready = r.vendorCompletedAt !== null;
      footer = (
        <View style={{ gap: space.s3 }}>
          {ready ? null : (
            <Text variant="bodySm" tone="textSecondary" align="center">
              {`Available once ${r.selectedVendor?.name ?? 'the company'} marks the trip done`}
            </Text>
          )}
          <Button
            label="Confirm trip’s done"
            disabled={!ready}
            loading={actions.busy === 'confirm'}
            onPress={() => void doConfirm()}
            testID="car-confirm-done"
          />
        </View>
      );
      after = (
        <Text variant="bodySm" tone="textSecondary">
          {`Confirm it’s done so ${r.selectedVendor?.name ?? 'the company'} is paid. Until then your money stays held.`}
        </Text>
      );
      break;
    }
    case 'done':
      footer = (
        <Button
          label="Rate your trip"
          variant="secondary"
          onPress={() => {
            setReviewing(true);
          }}
          testID="car-rate"
        />
      );
      break;
    case 'problem':
    case 'refunded':
    case 'cancelled':
      break;
  }

  const booked =
    stage === 'booked' ||
    stage === 'onTrip' ||
    stage === 'done' ||
    stage === 'problem' ||
    stage === 'refunded';
  return (
    <Screen
      scroll
      header={header}
      footer={
        footer === null && problem === null && notice === null ? undefined : (
          <View style={{ gap: space.s3 }}>
            {problem === null || cancelling ? null : <Banner tone="neutral" message={problem} />}
            {notice === null ? null : (
              <Banner
                tone="neutral"
                message={notice}
                onDismiss={() => {
                  setNotice(null);
                }}
                testID="car-notice"
              />
            )}
            {footer}
          </View>
        )
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void q.refetch().finally(() => {
              setRefreshing(false);
            });
          }}
          {...refreshColors}
        />
      }
    >
      <View style={{ gap: space.s7, paddingTop: space.s5, paddingBottom: space.s7 }}>
        {booked ? (
          <BookedView request={r} stage={stage} />
        ) : (
          <StatusView
            request={r}
            stage={stage}
            today={today}
            nowMs={clock.serverNow()}
            change={change}
            onChange={setChange}
          />
        )}
        {booked ? (
          <View style={{ gap: space.s3 }}>
            <Text variant="headline" accessibilityRole="header">
              {stage === 'problem' || stage === 'refunded' ? 'Need help?' : 'After your trip'}
            </Text>
            {after}
            <Button
              label="Report a problem"
              variant="secondary"
              onPress={reportProblem}
              testID="car-report"
            />
          </View>
        ) : null}
      </View>
      <CarCancelSheet
        visible={cancelling}
        paid={paid}
        busy={actions.busy === 'cancel' || checking}
        problem={cancelling ? problem : null}
        onCancel={(reason) => void doCancel(reason)}
        onClose={() => {
          setCancelling(false);
        }}
      />
      <ReviewSheet
        visible={reviewing}
        title={carName(r.selectedOffer?.vehicle ?? null, r.vehicleType)}
        when={
          r.returnDate === r.pickupDate
            ? longDate(r.pickupDate)
            : dateRange(r.pickupDate, r.returnDate)
        }
        state={review.state}
        onPost={review.post}
        onClose={() => {
          review.reset();
          setReviewing(false);
        }}
      />
    </Screen>
  );
}
