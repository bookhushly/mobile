import { CalendarDays } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import {
  bookingLine,
  splitBookings,
  type BookingTab,
  type ListingBooking,
} from '@/features/vendor/domain/listings';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  ListRow,
  refreshColors,
  Screen,
  SegmentedControl,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  kind: 'hotel' | 'apartment';
  today: IsoDate;
  tab: BookingTab;
  onTab: (t: BookingTab) => void;
  state:
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'ready'; bookings: ListingBooking[]; refreshing: boolean; refresh: () => void };
  onOpen: (b: ListingBooking) => void;
};

const EMPTY: Record<BookingTab, string> = {
  toConfirm: 'Nothing waiting for an answer',
  upcoming: 'No bookings coming up',
  staying: 'Nobody staying right now',
  past: 'No past bookings yet',
};

const STATUS: Record<ListingBooking['status'], string> = {
  pending: 'Waiting for you to confirm',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
};

/** Hotel and apartment bookings. Apartments confirm or decline here; hotels confirm on booking. */
export function BookingsScreen({ kind, today, tab, onTab, state, onOpen }: Props) {
  const split = state.status === 'ready' ? splitBookings(state.bookings, today) : null;
  const list = split?.[tab] ?? [];
  const count = (t: BookingTab) => (split ? { count: split[t].length } : {});
  const options = [
    ...(kind === 'apartment'
      ? [{ value: 'toConfirm' as const, label: 'To confirm', ...count('toConfirm') }]
      : []),
    { value: 'upcoming' as const, label: 'Upcoming', ...count('upcoming') },
    { value: 'staying' as const, label: 'Staying', ...count('staying') },
    { value: 'past' as const, label: 'Past' },
  ];
  return (
    <Screen
      scroll
      refreshControl={
        state.status === 'ready' ? (
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={state.refresh}
            {...refreshColors}
          />
        ) : undefined
      }
    >
      <View style={{ gap: space.s5, paddingTop: space.s5, paddingBottom: space.s8 }}>
        <Text variant="titleLg" accessibilityRole="header">
          Bookings
        </Text>
        <SegmentedControl
          value={tab}
          onChange={onTab}
          options={options}
          testID="vendor-bookings-tabs"
        />
        {state.status === 'loading' ? (
          <SkeletonRows count={4} />
        ) : state.status === 'error' ? (
          <ErrorState
            title="We couldn’t load your bookings"
            message="Check your connection and try again."
            onRetry={state.retry}
          />
        ) : list.length === 0 ? (
          <EmptyState icon={CalendarDays} title={EMPTY[tab]} />
        ) : (
          <View>
            {list.map((b) => (
              <ListRow
                key={b.id}
                title={b.guest}
                subtitle={`${b.unit}\n${bookingLine(b)}`}
                numberOfLines={2}
                trailing={
                  <Text
                    variant="caption"
                    tone={b.status === 'pending' ? 'textPrimary' : 'textSecondary'}
                  >
                    {STATUS[b.status]}
                  </Text>
                }
                onPress={() => {
                  onOpen(b);
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
