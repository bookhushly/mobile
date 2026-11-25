import { CalendarClock, History, Ticket } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { isPast, requestStage, type Stage } from '@/features/customer/domain/carRental/carStatus';
import { mergeByDate, sortByDate } from '@/features/customer/domain/mergeByDate';
import type { BookingKind, MyBooking } from '@/features/customer/domain/myBookings';
import { useCarRequests } from '@/features/customer/hooks/useCarRequests';
import { useLogisticsRequests } from '@/features/customer/hooks/useLogistics';
import type { CarRequest } from '@/features/customer/schemas/carRental';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import { useClaim } from '@/features/customer/hooks/useClaim';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import { useSentNotice } from '@/features/customer/hooks/sentNotice';
import { useUnreadCount } from '@/features/customer/hooks/useUnreadCount';
import { BellButton } from '@/features/customer/ui/BellButton';
import { BookingRow } from '@/features/customer/ui/BookingRow';
import { CarRequestRow } from '@/features/customer/ui/car/CarRequestRow';
import { LogisticsRequestRow } from '@/features/customer/ui/logistics/LogisticsRequestRow';
import { ClaimCard, claimCardKind } from '@/features/customer/ui/ClaimCard';
import { ClaimSheet } from '@/features/customer/ui/ClaimSheet';
import { mainAction } from '@/features/customer/ui/mainAction';
import { savedAtLabel } from '@/features/customer/ui/savedAt';
import { TodayCard } from '@/features/customer/ui/TodayCard';
import { clock } from '@/shared/api/instance';
import { space } from '@/shared/theme';
import {
  Banner,
  EmptyState,
  ErrorState,
  Header,
  refreshColors,
  Screen,
  SegmentedControl,
  SkeletonRows,
} from '@/shared/ui';

type Segment = 'upcoming' | 'past';

/** A request-for-quote in Bookings (car rental or logistics). */
type ReqItem =
  | { service: 'car'; r: CarRequest; stage: Stage }
  | { service: 'logistics'; r: LogisticsRequest; stage: Stage };
type Row =
  | { type: 'booking'; key: string; booking: MyBooking }
  | { type: 'request'; key: string; req: ReqItem };

type Props = {
  userId: string;
  /** The account email, shown masked on the guest bookings card and sheet. */
  email: string;
  onOpenBooking: (kind: BookingKind, id: string) => void;
  onShowTickets: (bookingId: string) => void;
  onShowCheckInCode: (bookingId: string) => void;
  onOpenNotifications: () => void;
  /** A car rental request (Phase 6). */
  onOpenCarRequest: (id: string) => void;
  /** A logistics request (Phase 6). */
  onOpenLogisticsRequest: (id: string) => void;
  /** The empty state's way on: the Explore tab (final review F3). */
  onBrowse: () => void;
};

// Spec §3 Bookings, C3, C16, C17.
export function BookingsScreen({
  userId,
  email,
  onOpenBooking,
  onShowTickets,
  onShowCheckInCode,
  onOpenNotifications,
  onOpenCarRequest,
  onOpenLogisticsRequest,
  onBrowse,
}: Props) {
  const my = useMyBookings(userId);
  // Car requests load on their own: a failure there never hides the bookings (or reads as none).
  const cars = useCarRequests(userId);
  const sends = useLogisticsRequests(userId);
  const unread = useUnreadCount(userId);
  // Spec E7: where the tickets of a transfer just made went (the booking has left the list).
  const sent = useSentNotice(userId);
  const [segment, setSegment] = useState<Segment>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  // Spec E4: the guest bookings card, dismissible for the session; one sheet for the flow.
  const claim = useClaim(userId);
  const [claimDismissed, setClaimDismissed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const cardKind = claimCardKind(claim.counts, claim.blocked);
  const openClaim = () => {
    setClaiming(true);
  };
  const claimCard = (dismissible: boolean) =>
    cardKind === null ? null : (
      <ClaimCard
        kind={cardKind}
        email={email}
        total={claim.counts?.total ?? 0}
        onAdd={openClaim}
        onDismiss={
          dismissible
            ? () => {
                setClaimDismissed(true);
              }
            : undefined
        }
      />
    );

  const refresh = () => {
    setRefreshing(true);
    void Promise.all([my.refetch(), cars.refetch(), sends.refetch()]).finally(() => {
      setRefreshing(false);
    });
  };
  const open = (b: MyBooking) => {
    onOpenBooking(b.kind, b.id);
  };
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />
  );

  const lists = my.bookings;
  let body: ReactNode;
  if (lists === null && my.loading) {
    body = <SkeletonRows count={6} />;
  } else if (lists === null) {
    // C17: a failed load never reads as "no bookings".
    body = (
      <ErrorState
        title="Couldn’t load your bookings"
        message="Check your connection and try again."
        onRetry={refresh}
      />
    );
  } else {
    // C9: the saved copy holds today and upcoming only, so offline it never claims "no bookings"
    // and never counts the past (spec §5, C17).
    const saved = my.saved !== null;
    const now = clock.serverNow();
    const carRows: ReqItem[] = [
      ...(cars.requests ?? []).map((r) => ({
        service: 'car' as const,
        r,
        stage: requestStage(r, now),
      })),
      ...(sends.requests ?? []).map((r) => ({
        service: 'logistics' as const,
        r,
        stage: requestStage(r, now),
      })),
    ];
    const carsUpcoming = carRows.filter((c) => !isPast(c.stage));
    const carsPast = carRows.filter((c) => isPast(c.stage));
    const carsShown = segment === 'upcoming' ? carsUpcoming : saved ? [] : carsPast;
    // Requests that failed (or haven't loaded) are unknown, never "none" (C17).
    const carsKnown = cars.requests !== null && sends.requests !== null;
    const nothing =
      !saved &&
      carsKnown &&
      carRows.length === 0 &&
      lists.today.length === 0 &&
      lists.upcoming.length === 0 &&
      lists.past.length === 0;
    const bookingRows = segment === 'upcoming' ? lists.upcoming : saved ? [] : lists.past;
    // One list in date order (owner, 2026-11-23): car requests by pick-up date among the stays and
    // events, soonest first under Upcoming and latest first under Past, as bookings already are.
    const order = segment === 'upcoming' ? 'asc' : 'desc';
    const rows: Row[] = mergeByDate(
      bookingRows.map((b) => ({ date: b.start, item: b })),
      sortByDate(
        carsShown.map((c) => ({ date: c.r.pickupDate, item: c })),
        order,
      ),
      order,
    ).map((x) =>
      x.from === 'a'
        ? { type: 'booking', key: `${x.item.kind}:${x.item.id}`, booking: x.item }
        : { type: 'request', key: `${x.item.service}:${x.item.r.id}`, req: x.item },
    );
    const header = (
      <View style={{ gap: space.s4, paddingBottom: space.s3 }}>
        {my.saved !== null ? (
          <Banner
            tone="neutral"
            message={`Showing saved bookings — last updated ${savedAtLabel(my.saved.savedAt, clock.serverNow())}. Pull to refresh.`}
          />
        ) : null}
        {sent.message !== null ? (
          <Banner
            tone="success"
            message={sent.message}
            onDismiss={sent.dismiss}
            testID="sent-notice"
          />
        ) : null}
        {(cars.failed || sends.failed) && !saved ? (
          <Banner
            tone="neutral"
            message={
              cars.failed && sends.failed
                ? 'Couldn’t load your car rentals and deliveries. Pull to refresh.'
                : cars.failed
                  ? 'Couldn’t load your car rentals. Pull to refresh.'
                  : 'Couldn’t load your deliveries. Pull to refresh.'
            }
            testID="cars-failed"
          />
        ) : null}
        {nothing || claimDismissed ? null : claimCard(true)}
        {lists.today.map((b, i) => (
          <TodayCard
            key={`${b.kind}:${b.id}`}
            booking={b}
            primary={i === 0}
            action={mainAction(b, my.rows)}
            onOpen={open}
            onShowTickets={(t) => {
              onShowTickets(t.id);
            }}
            onShowCheckInCode={(t) => {
              onShowCheckInCode(t.id);
            }}
          />
        ))}
        {nothing ? null : (
          <SegmentedControl
            value={segment}
            options={[
              {
                value: 'upcoming',
                label: 'Upcoming',
                count: lists.upcoming.length + carsUpcoming.length,
              },
              saved
                ? { value: 'past', label: 'Past' }
                : { value: 'past', label: 'Past', count: lists.past.length + carsPast.length },
            ]}
            onChange={setSegment}
          />
        )}
      </View>
    );
    let empty: ReactNode;
    if (carsShown.length > 0) empty = null;
    else if (cars.loading || sends.loading) empty = <SkeletonRows count={2} />;
    else if (nothing)
      empty = (
        <View style={{ gap: space.s4 }}>
          <EmptyState
            icon={Ticket}
            title="No bookings yet"
            message="Bookings you make while signed in with this email show up here."
            action={{ label: 'Browse', onPress: onBrowse }}
          />
          {/* StubHub's "don't see your orders?": the empty list offers the same path. */}
          {claimCard(false)}
        </View>
      );
    else if (segment === 'past')
      empty = saved ? (
        <EmptyState icon={History} title="Past bookings show when you’re back online" />
      ) : (
        <EmptyState icon={History} title="No past bookings" />
      );
    else
      empty = saved ? (
        <EmptyState
          icon={CalendarClock}
          title="No saved upcoming bookings"
          message="Pull to refresh when you’re back online"
        />
      ) : (
        <EmptyState icon={CalendarClock} title="No upcoming bookings" />
      );
    body = (
      <FlatList
        data={rows}
        style={{ flex: 1 }}
        keyExtractor={(row: Row) => row.key}
        initialNumToRender={10}
        windowSize={7}
        refreshControl={refreshControl}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) =>
          item.type === 'booking' ? (
            <BookingRow booking={item.booking} onPress={open} />
          ) : item.req.service === 'car' ? (
            <CarRequestRow request={item.req.r} stage={item.req.stage} onPress={onOpenCarRequest} />
          ) : (
            <LogisticsRequestRow
              request={item.req.r}
              stage={item.req.stage}
              onPress={onOpenLogisticsRequest}
            />
          )
        }
      />
    );
  }

  return (
    <Screen
      header={
        <Header
          title="Bookings"
          right={<BellButton unread={unread} onPress={onOpenNotifications} />}
        />
      }
    >
      {body}
      <ClaimSheet
        visible={claiming}
        email={email}
        state={claim.state}
        resendAt={claim.resendAt}
        onSend={claim.send}
        onVerify={claim.verify}
        onClose={() => {
          claim.reset();
          setClaiming(false);
        }}
      />
    </Screen>
  );
}
