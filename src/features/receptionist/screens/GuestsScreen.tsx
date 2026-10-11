import { ScanLine, UserRound, Users } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';

import {
  guestCounts,
  searchGuests,
  type GuestTab,
} from '@/features/receptionist/domain/guestLists';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useFreshness } from '@/features/receptionist/hooks/useFreshness';
import { useGuests } from '@/features/receptionist/hooks/useGuests';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { BookingDetail, type BookingActionHandlers } from '@/features/receptionist/ui/BookingDetail';
import { GuestRow } from '@/features/receptionist/ui/GuestRow';
import { layout, space } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  SearchField,
  SegmentedControl,
  SkeletonRows,
  Text,
  useWide,
} from '@/shared/ui';

type Props = BookingActionHandlers & {
  /** The route owns the tab (a `tab` param), so Today's count cells always land on their list. */
  tab: GuestTab;
  onTabChange: (tab: GuestTab) => void;
  /** Phones push the booking; on tablets the row opens in the right pane instead. */
  onOpenBooking: (id: string) => void;
};

const TABS: readonly { value: GuestTab; label: string }[] = [
  { value: 'arriving', label: 'Arriving' },
  { value: 'inHouse', label: 'In house' },
  { value: 'leaving', label: 'Leaving' },
];
const EMPTY: Record<GuestTab, string> = {
  arriving: 'No arrivals left today',
  inHouse: 'No guests checked in',
  leaving: 'Nobody is due out today',
};
const LIST_PANE_WIDTH = 380;

// Spec §3 Guests: segmented tabs with counts, search, rows → booking. Tablet: list | detail (R12).
export function GuestsScreen({
  tab,
  onTabChange,
  onOpenBooking,
  onChooseRoom,
  onCheckOut,
}: Props) {
  const { today, openAccount, openCheckIn } = useDesk();
  const wide = useWide();
  const guests = useGuests();
  const freshness = useFreshness(guests.updatedAt);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const lists = guests.lists;
  const counts = lists === null ? null : guestCounts(lists);
  const rows = lists === null ? [] : searchGuests(lists[tab], query);
  const q = query.trim();
  // The pane follows the data: a guest who leaves every list (checked out) closes it.
  const selected =
    wide && selectedId !== null && lists !== null
      ? (lists.inHouse.find((b) => b.id === selectedId) ??
        lists.arriving.find((b) => b.id === selectedId) ??
        null)
      : null;

  const open = (id: string) => {
    if (wide) setSelectedId(id);
    else onOpenBooking(id);
  };
  // A new tab starts without a detail open: the old guest may not be in this list at all.
  const changeTab = (next: GuestTab) => {
    setSelectedId(null);
    onTabChange(next);
  };

  let list: ReactNode;
  if (guests.loading) {
    list = <SkeletonRows count={6} />;
  } else if (guests.error || lists === null) {
    list = (
      <ErrorState
        title="Couldn't load guests"
        message="Check the connection and try again."
        onRetry={() => {
          void guests.refetch();
        }}
      />
    );
  } else {
    list = (
      <FlatList
        data={rows}
        style={{ flex: 1 }}
        keyExtractor={(b: BookingRow) => b.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <GuestRow
            booking={item}
            today={today}
            onPress={open}
            selected={wide ? item.id === selectedId : undefined}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={Users}
            title={q === '' ? EMPTY[tab] : `No guest matches “${q}”`}
          />
        }
      />
    );
  }

  const left = (
    <View style={{ flex: 1, gap: space.s4 }}>
      {freshness !== null ? (
        <Text variant="bodySm" tone="textMuted" accessibilityLiveRegion="polite">
          {freshness}
        </Text>
      ) : null}
      <SegmentedControl
        value={tab}
        options={TABS.map((t) => ({ ...t, count: counts?.[t.value] ?? 0 }))}
        onChange={changeTab}
      />
      <SearchField
        label="Search guests"
        placeholder="Name, phone, room or code"
        value={query}
        onChangeText={setQuery}
      />
      {list}
    </View>
  );

  return (
    <Screen
      width={wide ? 'panel' : 'form'}
      header={
        <Header
          title="Guests"
          right={
            <View style={{ flexDirection: 'row', gap: space.s3 }}>
              <IconButton
                icon={ScanLine}
                accessibilityLabel="Check in a guest"
                onPress={() => {
                  openCheckIn();
                }}
              />
              <IconButton icon={UserRound} accessibilityLabel="Account" onPress={openAccount} />
            </View>
          }
        />
      }
    >
      {wide ? (
        <View style={{ flex: 1, flexDirection: 'row', gap: layout.tabletGutter }}>
          <View style={{ width: LIST_PANE_WIDTH }}>{left}</View>
          <View style={{ flex: 1 }} testID="guest-detail-pane">
            {selected === null ? (
              <EmptyState icon={Users} title="Choose a guest" />
            ) : (
              <BookingDetail
                booking={selected}
                onChooseRoom={onChooseRoom}
                onCheckOut={onCheckOut}
              />
            )}
          </View>
        </View>
      ) : (
        left
      )}
    </Screen>
  );
}
