import { CalendarClock, History, Ticket } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import type { BookingKind, MyBooking } from '@/features/customer/domain/myBookings';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import { useNotifications } from '@/features/customer/hooks/useNotifications';
import { BellButton } from '@/features/customer/ui/BellButton';
import { BookingRow } from '@/features/customer/ui/BookingRow';
import { openWeb, WEB_HOME } from '@/features/customer/ui/links';
import { mainAction } from '@/features/customer/ui/mainAction';
import { savedAtLabel } from '@/features/customer/ui/savedAt';
import { TodayCard } from '@/features/customer/ui/TodayCard';
import { clock } from '@/shared/api/instance';
import { color, space } from '@/shared/theme';
import {
  Banner,
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SegmentedControl,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Segment = 'upcoming' | 'past';

type Props = {
  userId: string;
  onOpenBooking: (kind: BookingKind, id: string) => void;
  onShowTickets: (bookingId: string) => void;
  onShowCheckInCode: (bookingId: string) => void;
  onOpenNotifications: () => void;
};

const GUEST_LINE =
  "Booked as a guest before you had an account? Those bookings can't be shown in the app yet.";

// Spec §3 Bookings, C3, C16, C17.
export function BookingsScreen({
  userId,
  onOpenBooking,
  onShowTickets,
  onShowCheckInCode,
  onOpenNotifications,
}: Props) {
  const my = useMyBookings(userId);
  const { unread } = useNotifications(userId);
  const [segment, setSegment] = useState<Segment>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    void my.refetch().finally(() => {
      setRefreshing(false);
    });
  };
  const open = (b: MyBooking) => {
    onOpenBooking(b.kind, b.id);
  };
  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={refresh}
      tintColor={color.textSecondary}
      colors={[color.actionFill]}
      progressBackgroundColor={color.surface}
    />
  );

  const lists = my.bookings;
  let body: ReactNode;
  if (lists === null && my.loading) {
    body = <SkeletonRows count={6} />;
  } else if (lists === null) {
    // C17: a failed load never reads as "no bookings".
    body = (
      <ErrorState
        title="Couldn't load your bookings"
        message="Check the connection and try again."
        onRetry={refresh}
      />
    );
  } else {
    const nothing =
      lists.today.length === 0 && lists.upcoming.length === 0 && lists.past.length === 0;
    const rows = segment === 'upcoming' ? lists.upcoming : lists.past;
    const header = (
      <View style={{ gap: space.s4, paddingBottom: space.s3 }}>
        {my.saved !== null ? (
          <Banner
            tone="neutral"
            message={`Showing saved bookings — last updated ${savedAtLabel(my.saved.savedAt, clock.serverNow())}. Pull to refresh.`}
          />
        ) : null}
        {lists.today.map((b) => (
          <TodayCard
            key={`${b.kind}:${b.id}`}
            booking={b}
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
              { value: 'upcoming', label: 'Upcoming', count: lists.upcoming.length },
              { value: 'past', label: 'Past', count: lists.past.length },
            ]}
            onChange={setSegment}
          />
        )}
      </View>
    );
    const empty = nothing ? (
      <View style={{ gap: space.s4 }}>
        <EmptyState
          icon={Ticket}
          title="No bookings yet"
          message="Bookings you make while signed in with this email show up here."
          action={{
            label: 'Browse on bookhushly.com',
            onPress: () => {
              openWeb(WEB_HOME);
            },
          }}
        />
        <Text variant="bodySm" tone="textSecondary" align="center">
          {GUEST_LINE}
        </Text>
      </View>
    ) : segment === 'upcoming' ? (
      <EmptyState icon={CalendarClock} title="No upcoming bookings" />
    ) : (
      <EmptyState icon={History} title="No past bookings" />
    );
    body = (
      <FlatList
        data={rows}
        style={{ flex: 1 }}
        keyExtractor={(b: MyBooking) => `${b.kind}:${b.id}`}
        initialNumToRender={10}
        windowSize={7}
        refreshControl={refreshControl}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <BookingRow booking={item} onPress={open} />}
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
    </Screen>
  );
}
