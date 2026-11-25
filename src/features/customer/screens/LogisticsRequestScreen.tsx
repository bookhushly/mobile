import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';

import {
  canCancel,
  isPaidStatus,
  pendingQuotes,
  requestStage,
} from '@/features/customer/domain/carRental/carStatus';
import { trackPhase } from '@/features/customer/domain/logistics/tracking';
import { LOGISTICS_KIND } from '@/features/customer/hooks/rfqKinds';
import { useLogisticsDraft } from '@/features/customer/hooks/useLogisticsDraft';
import { useRequestScreen } from '@/features/customer/hooks/useRequestScreen';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import { ReviewSheet } from '@/features/customer/ui/ReviewSheet';
import { CarCancelSheet } from '@/features/customer/ui/car/CarCancelSheet';
import { PayFooter } from '@/features/customer/ui/car/PayFooter';
import { RequestFooter } from '@/features/customer/ui/car/RequestFooter';
import { RequestLoadError } from '@/features/customer/ui/car/RequestLoadError';
import { RfqStatusView } from '@/features/customer/ui/car/RfqStatusView';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { LOGISTICS_TERMS } from '@/features/customer/ui/car/quoteTerms';
import { TrackingView } from '@/features/customer/ui/logistics/TrackingView';
import {
  LOGISTICS_VEHICLE,
  SERVICE,
  stateRoute,
} from '@/features/customer/ui/logistics/logisticsWords';
import { clock } from '@/shared/api/instance';
import { lagosToday, shortDate } from '@/shared/lib/lagosDay';
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

/** The old answers, for "Ask again" after no quotes (dates cleared if already past). */
function askAgain(r: LogisticsRequest, today: string) {
  const keepDate = r.pickupDate >= today;
  return {
    serviceType: r.serviceType,
    pickup: { address: r.pickupAddress, landmark: r.pickupLandmark ?? '', state: r.pickupState },
    dropoff: {
      address: r.deliveryAddress,
      landmark: r.deliveryLandmark ?? '',
      state: r.deliveryState,
    },
    pickupDate: keepDate ? r.pickupDate : null,
    deliveryDate:
      keepDate && r.deliveryDate !== null && r.deliveryDate >= today ? r.deliveryDate : null,
    pickupTime: r.pickupTime,
    itemDescription: r.itemDescription,
    itemCategory: r.itemCategory,
    itemWeight: r.itemWeight,
    quantity: r.quantity,
    vehicleType: r.vehicleType,
    packaging: r.packaging,
    insurance: false,
    fragile: r.fragile,
    perishable: r.perishable,
    notes: r.notes ?? '',
  };
}

// Designs L2 and L3: the shared status screen until it's paid, then tracking.
export function LogisticsRequestScreen({ userId, id, onBack, onSeeQuotes, onAskAgain }: Props) {
  const v = useRequestScreen(LOGISTICS_KIND, userId, id);
  const { q, r, actions, review, pay } = v;
  const startDraft = useLogisticsDraft((s) => s.start);
  const today = lagosToday(clock.serverNow());
  const header = (
    <Header
      title={r === null ? 'Delivery' : SERVICE[r.serviceType].label}
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );
  if (r === null) {
    return (
      <Screen header={header}>
        {q.loading ? (
          <SkeletonRows count={5} />
        ) : (
          <RequestLoadError error={q.error} what="this request" onRetry={() => void q.refetch()} />
        )}
      </Screen>
    );
  }

  const stage = requestStage(r, clock.serverNow());
  const quotes = pendingQuotes(r.offers);
  const paid = isPaidStatus(r.status);
  const company = r.selectedVendor?.name ?? 'the company';
  const cancelLink =
    canCancel(r.status) && !v.payOpen ? (
      <Button
        label={paid ? 'Cancel booking' : 'Cancel request'}
        variant="ghost"
        onPress={v.openCancel}
        testID="car-cancel"
      />
    ) : null;

  let footer: ReactNode = null;
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
            const next = askAgain(r, today);
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
      break;
    case 'onTrip': {
      // The server confirms only once the company has marked the job done (`vendor_completed_at`),
      // not on the delivery time alone.
      const marked = r.vendorCompletedAt !== null;
      footer = (
        <View style={{ gap: space.s3 }}>
          {marked ? null : (
            <Text variant="bodySm" tone="textSecondary" align="center">
              {`Available once ${company} marks it delivered`}
            </Text>
          )}
          <Button
            label="Confirm it arrived"
            disabled={!marked}
            loading={actions.busy === 'confirm'}
            onPress={() => void v.confirmDone()}
            testID="logistics-confirm"
          />
        </View>
      );
      break;
    }
    case 'done':
      footer = (
        <Button
          label="Rate the delivery"
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

  const tracking =
    stage === 'booked' ||
    stage === 'onTrip' ||
    stage === 'done' ||
    stage === 'problem' ||
    stage === 'refunded';
  const what = [
    stateRoute(r.pickupState, r.deliveryState, stateName),
    r.vehicleType === null ? null : LOGISTICS_VEHICLE[r.vehicleType].label.toLowerCase(),
    shortDate(r.pickupDate),
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
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
        {tracking ? (
          <TrackingView request={r} stage={stage} nowMs={clock.serverNow()} />
        ) : (
          <RfqStatusView
            request={r}
            stage={stage}
            today={today}
            nowMs={clock.serverNow()}
            copy={{
              companies: 'logistics companies',
              what,
              priceFor: null,
              chosen: `${r.selectedVendor?.name ?? 'a company'}’s ${r.selectedOffer === null ? 'quote' : LOGISTICS_TERMS.nameOf(r.selectedOffer, r).toLowerCase()}`,
              payTitle: 'Pay to book the delivery',
              doneWords: 'it’s delivered',
              lastStep: 'It’s delivered',
              askedFor: `this ${SERVICE[r.serviceType].noun.toLowerCase()}`,
            }}
          />
        )}
        {tracking ? (
          <View style={{ gap: space.s3 }}>
            <Text variant="headline" accessibilityRole="header">
              {stage === 'problem' || stage === 'refunded'
                ? 'Need help?'
                : trackPhase({ ...r, confirmed: stage === 'done' }) === 'delivered' ||
                    stage === 'done'
                  ? 'After it arrives'
                  : 'Something wrong?'}
            </Text>
            {stage === 'booked' || stage === 'onTrip' ? (
              <Text variant="bodySm" tone="textSecondary">
                {`Confirm it arrived so ${company} is paid. Until then your money stays held.`}
              </Text>
            ) : null}
            <Button
              label="Report a problem"
              variant="secondary"
              onPress={() => {
                v.reportProblem(SERVICE[r.serviceType].label);
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
        reasonRequired
        onCancel={(reason) => void v.cancel(reason)}
        onClose={v.closeCancel}
      />
      <ReviewSheet
        visible={v.reviewing}
        title={SERVICE[r.serviceType].label}
        when={shortDate(r.pickupDate)}
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
