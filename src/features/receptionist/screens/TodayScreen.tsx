import { ScanLine, Sunrise, UserRound } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';

import { guestCounts, type GuestTab } from '@/features/receptionist/domain/guestLists';
import { roomCounts } from '@/features/receptionist/domain/roomBoard';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useFreshness } from '@/features/receptionist/hooks/useFreshness';
import { useGuests } from '@/features/receptionist/hooks/useGuests';
import { useRooms } from '@/features/receptionist/hooks/useRooms';
import { CountCard, type CountKey } from '@/features/receptionist/ui/CountCard';
import { GuestRow } from '@/features/receptionist/ui/GuestRow';
import { longDate } from '@/shared/lib/lagosDay';
import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  SectionHeader,
  SkeletonRows,
  Stack,
  Text,
  TextLink,
} from '@/shared/ui';

type Props = {
  onOpenGuests: (tab: GuestTab) => void;
  onOpenFreeRooms: () => void;
  onOpenBooking: (id: string) => void;
};

const ARRIVALS_SHOWN = 8;

// Spec §3 Today: counts card, Check in a guest, today's arrivals, freshness line (R10).
export function TodayScreen({ onOpenGuests, onOpenFreeRooms, onOpenBooking }: Props) {
  const { hotel, today, openAccount, openCheckIn } = useDesk();
  const guests = useGuests();
  const rooms = useRooms();
  const freshness = useFreshness(guests.updatedAt);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    void Promise.all([guests.refetch(), rooms.refetch()]).finally(() => {
      setRefreshing(false);
    });
  };
  const openCount = (key: CountKey) => {
    if (key === 'freeRooms') onOpenFreeRooms();
    else onOpenGuests(key);
  };

  let body: ReactNode;
  if (guests.loading) {
    body = <SkeletonRows count={6} />;
  } else if (guests.error || guests.lists === null) {
    body = (
      <ErrorState
        title="Couldn't load today"
        message="Check the connection and try again."
        onRetry={refresh}
      />
    );
  } else {
    const lists = guests.lists;
    const arriving = lists.arriving;
    const shown = arriving.slice(0, ARRIVALS_SHOWN);
    body = (
      <Stack gap="s5">
        {freshness !== null ? (
          <Text variant="bodySm" tone="textMuted" accessibilityLiveRegion="polite">
            {freshness}
          </Text>
        ) : null}
        <CountCard
          counts={{
            ...guestCounts(lists),
            freeRooms: rooms.loading || rooms.error ? null : roomCounts(rooms.rooms).available,
          }}
          onPress={openCount}
        />
        <View>
          <SectionHeader label="Arriving today" count={arriving.length} />
          {shown.length === 0 ? (
            <EmptyState icon={Sunrise} title="No more arrivals today" />
          ) : (
            shown.map((b) => (
              <GuestRow key={b.id} booking={b} today={today} onPress={onOpenBooking} />
            ))
          )}
          {arriving.length > shown.length ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <TextLink
                label="See all"
                accessibilityLabel={`See all ${String(arriving.length)} arriving`}
                onPress={() => {
                  onOpenGuests('arriving');
                }}
              />
            </View>
          ) : null}
        </View>
      </Stack>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      header={
        <Header
          title={hotel.name}
          subtitle={longDate(today)}
          right={<IconButton icon={UserRound} accessibilityLabel="Account" onPress={openAccount} />}
        />
      }
    >
      {/* Always offered: typing a code needs no list, so a failed read must not block a check-in. */}
      <Button
        label="Check in a guest"
        icon={ScanLine}
        onPress={() => {
          openCheckIn();
        }}
      />
      {body}
    </Screen>
  );
}
