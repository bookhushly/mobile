import { ArrowLeft } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';

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
import { CAR_KIND } from '@/features/customer/hooks/rfqKinds';
import { useCarDraft } from '@/features/customer/hooks/useCarDraft';
import { useRequestScreen } from '@/features/customer/hooks/useRequestScreen';
import { ReviewSheet } from '@/features/customer/ui/ReviewSheet';
import { BookedView } from '@/features/customer/ui/car/BookedView';
import { CarCancelSheet } from '@/features/customer/ui/car/CarCancelSheet';
import { PayFooter } from '@/features/customer/ui/car/PayFooter';
import { RequestFooter } from '@/features/customer/ui/car/RequestFooter';
import { RequestLoadError } from '@/features/customer/ui/car/RequestLoadError';
import { StatusView } from '@/features/customer/ui/car/StatusView';
import { carName, dateRange } from '@/features/customer/ui/car/carWords';
import { clock } from '@/shared/api/instance';
import { lagosToday, longDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Button, Header, IconButton, refreshColors, Screen, SkeletonRows, Text } from '@/shared/ui';

type Props = {
  userId: string;
  id: string;
  onBack: () => void;
  onSeeQuotes: () => void;
  /** "Ask again": the flow, already filled in. */
  onAskAgain: () => void;
};

export function CarRequestScreen({ userId, id, onBack, onSeeQuotes, onAskAgain }: Props) {
  const v = useRequestScreen(CAR_KIND, userId, id);
  const { q, r, actions, review, pay } = v;
  const startDraft = useCarDraft((s) => s.start);
  const [change, setChange] = useState<AskAgainChange | null>(null);
  const today = lagosToday(clock.serverNow());

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

  const cancelLink =
    cancellable && !v.payOpen ? (
      <Button
        label={paid ? 'Cancel booking' : 'Cancel request'}
        variant="ghost"
        onPress={v.openCancel}
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
    case 'chosen':
      footer = (
        <PayFooter
          state={pay.state}
          amount={v.payTotal}
          note={v.payNote}
          onPay={pay.pay}
          onCheckAgain={pay.checkAgain}
          cancel={cancelLink}
        />
      );
      break;
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
            onPress={() => void v.confirmDone()}
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
            v.setReviewing(true);
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
        footer === null && v.problem === null && v.notice === null ? undefined : (
          <RequestFooter
            problem={v.problem}
            cancelling={v.cancelling}
            notice={v.notice}
            onDismissNotice={v.clearNotice}
          >
            {footer}
          </RequestFooter>
        )
      }
      refreshControl={
        <RefreshControl refreshing={v.refreshing} onRefresh={v.refresh} {...refreshColors} />
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
              onPress={() => {
                v.reportProblem('Car rental');
              }}
              testID="car-report"
            />
          </View>
        ) : null}
      </View>
      <CarCancelSheet
        visible={v.cancelling}
        paid={paid}
        busy={v.cancelBusy}
        problem={v.cancelling ? v.problem : null}
        onCancel={(reason) => void v.cancel(reason)}
        onClose={v.closeCancel}
      />
      <ReviewSheet
        visible={v.reviewing}
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
          v.setReviewing(false);
        }}
      />
    </Screen>
  );
}
