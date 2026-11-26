import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  apartmentMoves,
  bookingLine,
  type ListingBooking,
  type StayStatus,
} from '@/features/vendor/domain/listings';
import type { StayProblem } from '@/features/vendor/hooks/useListings';
import { borderWidth, color, radius, space } from '@/shared/theme';
import {
  Banner,
  Button,
  ErrorState,
  formatNaira,
  Header,
  IconButton,
  Screen,
  Sheet,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  state:
    | { status: 'loading' }
    | { status: 'error'; notFound: boolean; retry: () => void }
    | { status: 'ready'; booking: ListingBooking };
  busy: boolean;
  problem: StayProblem | null;
  onBack: () => void;
  onMove: (from: StayStatus, to: StayStatus) => void;
  /** Hotels: open the front desk to check in; null until it opens to owners. */
  onFrontDesk: (() => void) | null;
};

const HEADLINE: Record<StayStatus, string> = {
  pending: 'Waiting for you to confirm',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
};

const MOVE_LABEL: Partial<Record<StayStatus, string>> = {
  confirmed: 'Confirm booking',
  checked_in: 'Check in',
  checked_out: 'Check out',
};

const PAYMENT: Record<ListingBooking['payment'], string> = {
  paid: 'Paid online',
  payAtHotel: 'Pays at the hotel',
  unpaid: 'Not paid yet',
};

/** One stay. Apartments move through confirm → check in → check out here (the web route's rules). */
export function BookingScreen({ state, busy, problem, onBack, onMove, onFrontDesk }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const header = (
    <Header
      title=""
      left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
    />
  );
  if (state.status !== 'ready')
    return (
      <Screen header={header}>
        {state.status === 'loading' ? (
          <SkeletonRows count={4} />
        ) : (
          <ErrorState
            title={
              state.notFound ? 'This booking isn’t available' : 'We couldn’t load this booking'
            }
            message={
              state.notFound ? 'It may have been removed.' : 'Check your connection and try again.'
            }
            onRetry={state.notFound ? onBack : state.retry}
          />
        )}
      </Screen>
    );

  const b = state.booking;
  const moves = apartmentMoves(b);
  const forward = moves.find((m) => m !== 'cancelled') ?? null;
  const canCancel = moves.includes('cancelled');
  const declining = b.status === 'pending';

  const footer =
    moves.length === 0 &&
    !(b.kind === 'hotel' && b.status === 'confirmed') &&
    problem === null ? undefined : (
      <View style={{ gap: space.s3 }}>
        {problem === null ? null : (
          <Banner
            tone={problem.transient ? 'neutral' : 'warning'}
            title={problem.title}
            message={problem.message}
          />
        )}
        {forward === null ? null : (
          <Text variant="label" align="center" tabular>
            {`${formatNaira(b.total)} · ${PAYMENT[b.payment]}`}
          </Text>
        )}
        {forward === null ? null : (
          <Button
            label={MOVE_LABEL[forward] ?? 'Continue'}
            loading={busy}
            onPress={() => {
              onMove(b.status, forward);
            }}
            testID="vendor-booking-forward"
          />
        )}
        {canCancel ? (
          <Button
            label={declining ? 'Decline booking' : 'Cancel booking'}
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setCancelling(true);
            }}
            testID="vendor-booking-cancel"
          />
        ) : null}
        {b.kind === 'hotel' && b.status === 'confirmed' ? (
          onFrontDesk === null ? (
            <Text variant="caption" tone="textSecondary" align="center">
              Your front-desk staff check guests in from their Bookhushly app.
            </Text>
          ) : (
            <Button label="Check in at the front desk" onPress={onFrontDesk} />
          )
        ) : null}
      </View>
    );

  return (
    <Screen scroll header={header} footer={footer}>
      <View style={{ gap: space.s6, paddingBottom: space.s7 }}>
        <View style={{ gap: space.s2 }}>
          <Text variant="caption" tone="textSecondary">
            {b.unit}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {b.guest}
          </Text>
          <Text variant="label" testID="vendor-booking-status">
            {HEADLINE[b.status]}
          </Text>
        </View>
        <View
          style={{
            borderWidth: borderWidth.hairline,
            borderColor: color.border,
            borderRadius: radius.r4,
            padding: space.s5,
            gap: space.s3,
          }}
        >
          <Text variant="bodySm">{bookingLine(b)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="bodySm" tone="textSecondary">
              {PAYMENT[b.payment]}
            </Text>
            <Text variant="label" tabular>
              {formatNaira(b.total)}
            </Text>
          </View>
        </View>
      </View>
      <Sheet
        visible={cancelling}
        title={declining ? 'Decline this booking?' : 'Cancel this booking?'}
        onClose={() => {
          setCancelling(false);
        }}
        footer={
          <Button
            label={declining ? 'Decline booking' : 'Cancel booking'}
            variant="destructive"
            loading={busy}
            onPress={() => {
              setCancelling(false);
              onMove(b.status, 'cancelled');
            }}
            testID="vendor-booking-cancel-confirm"
          />
        }
      >
        <Text variant="body" tone="textSecondary">
          {b.payment === 'paid'
            ? `The booking is marked cancelled. ${b.guest} isn’t told and isn’t refunded automatically yet: contact them, and email support@bookhushly.com about the refund.`
            : `The booking is marked cancelled. ${b.guest} isn’t told automatically yet, so let them know.`}
        </Text>
      </Sheet>
    </Screen>
  );
}
