import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';

import {
  canCancel,
  isPaidStatus,
  pendingQuotes,
  requestStage,
} from '@/features/customer/domain/carRental/carStatus';
import { SECURITY_KIND } from '@/features/customer/hooks/rfqKinds';
import { useSecurityDraft } from '@/features/customer/hooks/useSecurity';
import { useRequestScreen } from '@/features/customer/hooks/useRequestScreen';
import type { SecurityRequest } from '@/features/customer/schemas/security';
import { ReviewSheet } from '@/features/customer/ui/ReviewSheet';
import { CarCancelSheet } from '@/features/customer/ui/car/CarCancelSheet';
import { PayFooter } from '@/features/customer/ui/car/PayFooter';
import { RequestFooter } from '@/features/customer/ui/car/RequestFooter';
import { RequestLoadError } from '@/features/customer/ui/car/RequestLoadError';
import { RfqStatusView } from '@/features/customer/ui/car/RfqStatusView';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { SecurityBookedView } from '@/features/customer/ui/security/SecurityBookedView';
import { SECURITY_SERVICE, teamWords } from '@/features/customer/ui/security/securityWords';
import { clock } from '@/shared/api/instance';
import { dateRange } from '@/features/customer/ui/car/carWords';
import { lagosToday } from '@/shared/lib/lagosDay';
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
function askAgain(r: SecurityRequest, today: string) {
  const keepDate = r.pickupDate >= today;
  return {
    service: r.service,
    address: r.address,
    landmark: r.landmark ?? '',
    state: r.pickupState,
    startDate: keepDate ? r.pickupDate : null,
    endDate: keepDate && r.endDate !== null && r.endDate >= today ? r.endDate : null,
    startTime: r.startTime,
    duration: r.duration,
    shift: r.shift,
    guards: r.guards,
    guardType: r.guardType,
    canine: r.canine,
    vehicle: r.vehicle,
    notes: r.notes ?? '',
    ...r.details,
  };
}

// The shared status screen until it's paid, then what's booked.
export function SecurityRequestScreen({ userId, id, onBack, onSeeQuotes, onAskAgain }: Props) {
  const v = useRequestScreen(SECURITY_KIND, userId, id);
  const { q, r, actions, review, pay } = v;
  const startDraft = useSecurityDraft((s) => s.start);
  const today = lagosToday(clock.serverNow());
  const header = (
    <Header
      title={r === null ? 'Security' : SECURITY_SERVICE[r.service].label}
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );
  if (r === null) {
    return (
      <Screen header={header}>
        {q.loading ? (
          <SkeletonRows count={5} />
        ) : (
          <RequestLoadError
            error={q.error}
            what="this request"
            icon={ShieldCheck}
            requestsWord="Security requests"
            onRetry={() => void q.refetch()}
          />
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
            // Start where something is missing (dates past, or a web request without the team).
            startDraft(
              next,
              next.startDate === null
                ? 'when'
                : next.duration === null || next.guardType === null
                  ? 'team'
                  : 'check',
            );
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
      // The server confirms only once the company has marked the job done.
      const marked = r.vendorCompletedAt !== null;
      footer = (
        <View style={{ gap: space.s3 }}>
          {marked ? null : (
            <Text variant="bodySm" tone="textSecondary" align="center">
              {`Available once ${company} marks the job done`}
            </Text>
          )}
          <Button
            label="Confirm the job’s done"
            disabled={!marked}
            loading={actions.busy === 'confirm'}
            onPress={() => void v.confirmDone()}
            testID="security-confirm"
          />
        </View>
      );
      break;
    }
    case 'done':
      footer = (
        <Button
          label="Rate the service"
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
  const what = [stateName(r.pickupState), teamWords(r), dateRange(r.pickupDate, r.endDate)].join(
    ' · ',
  );
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
          <SecurityBookedView request={r} stage={stage} />
        ) : (
          <RfqStatusView
            request={r}
            stage={stage}
            today={today}
            nowMs={clock.serverNow()}
            copy={{
              companies: 'security companies',
              what,
              priceFor: null,
              chosen: `${r.selectedVendor?.name ?? 'a company'}’s quote`,
              payTitle: 'Pay to book the guards',
              doneWords: 'the job’s done',
              lastStep: 'The guards start',
              askedFor: 'this request',
            }}
          />
        )}
        {tracking ? (
          <View style={{ gap: space.s3 }}>
            <Text variant="headline" accessibilityRole="header">
              {stage === 'problem' || stage === 'refunded'
                ? 'Need help?'
                : stage === 'done' || r.vendorCompletedAt !== null
                  ? 'After the job'
                  : 'Something wrong?'}
            </Text>
            {stage === 'booked' || stage === 'onTrip' ? (
              <Text variant="bodySm" tone="textSecondary">
                {`Confirm the job’s done so ${company} is paid. Until then your money stays held.`}
              </Text>
            ) : null}
            <Button
              label="Report a problem"
              variant="secondary"
              onPress={() => {
                v.reportProblem(SECURITY_SERVICE[r.service].label);
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
        title={SECURITY_SERVICE[r.service].label}
        when={dateRange(r.pickupDate, r.endDate)}
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
