import { BedDouble, UserRound } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';

import {
  filterRooms,
  roomCounts,
  ROOM_STATUS_LABEL,
  type RoomFilter,
} from '@/features/receptionist/domain/roomBoard';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useFreshness } from '@/features/receptionist/hooks/useFreshness';
import { useRooms } from '@/features/receptionist/hooks/useRooms';
import { ROOM_STATUSES, type RoomRow as Room } from '@/features/receptionist/schemas/desk';
import { RoomRow } from '@/features/receptionist/ui/RoomRow';
import { RoomSheet } from '@/features/receptionist/ui/RoomSheet';
import { ROOM_TILE_MIN_WIDTH, RoomTile } from '@/features/receptionist/ui/RoomTile';
import { statusPhrase } from '@/features/receptionist/ui/roomTone';
import { layout, space } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  FilterChips,
  Header,
  IconButton,
  Screen,
  SkeletonRows,
  Text,
  useWide,
} from '@/shared/ui';

type Props = {
  /** The route owns the filter (a `filter` param), so Today's "free rooms" always lands on it. */
  filter: RoomFilter;
  onFilterChange: (filter: RoomFilter) => void;
  onOpenBooking: (bookingId: string) => void;
};

const FILTERS: readonly RoomFilter[] = ['all', ...ROOM_STATUSES];
const TILE_GAP = space.s3;
// About one screen of rows first, and a smaller render window than the default 21 screens.
const LIST_FIRST_BATCH = 12;
const LIST_WINDOW = 7;

const filterLabel = (f: RoomFilter) => (f === 'all' ? 'All' : ROOM_STATUS_LABEL[f]);

// Tiles per row for the grid's width; the last row is padded with spacers so tiles keep one size.
export function gridColumns(width: number): number {
  return Math.max(1, Math.floor((width + TILE_GAP) / (ROOM_TILE_MIN_WIDTH + TILE_GAP)));
}
type Cell = Room | { id: string; spacer: true };
function padded(rooms: Room[], cols: number): Cell[] {
  const cells: Cell[] = [...rooms];
  while (cells.length % cols !== 0)
    cells.push({ id: `spacer-${String(cells.length)}`, spacer: true });
  return cells;
}

// Spec §3 Rooms: filter chips with counts, phone rows / tablet tiles, tap → Room sheet (R18).
export function RoomsScreen({ filter, onFilterChange, onOpenBooking }: Props) {
  const { today, openAccount } = useDesk();
  const wide = useWide();
  const window = useWindowDimensions();
  const rooms = useRooms();
  const freshness = useFreshness(rooms.updatedAt);
  const [opened, setOpened] = useState<Room | null>(null);

  const counts = roomCounts(rooms.rooms);
  const shown = filterRooms(rooms.rooms, filter);
  // The sheet follows the board (a status change elsewhere shows); a vanished room keeps its last.
  const live = opened === null ? null : (rooms.rooms.find((r) => r.id === opened.id) ?? opened);
  const close = () => {
    setOpened(null);
  };

  const empty = (
    <EmptyState
      icon={BedDouble}
      title={
        filter === 'all'
          ? 'No rooms at this hotel yet'
          : `No rooms are ${statusPhrase(filter)} right now.`
      }
    />
  );

  let list: ReactNode;
  if (rooms.loading) list = <SkeletonRows count={6} />;
  else if (rooms.error)
    list = (
      <ErrorState
        title="Couldn't load rooms"
        message="Check the connection and try again."
        onRetry={() => {
          void rooms.refetch();
        }}
      />
    );
  else if (wide) {
    // From the window alone (rail and gutters are fixed tokens), so the column count — and the
    // list's key — only change on rotation, never after the first layout pass.
    const width =
      Math.min(window.width - layout.tabletRailWidth, layout.panelMaxWidth) -
      2 * layout.tabletGutter;
    const cols = gridColumns(width);
    list = (
      <FlatList
        key={`cols-${String(cols)}`}
        data={shown.length === 0 ? [] : padded(shown, cols)}
        numColumns={cols}
        style={{ flex: 1 }}
        keyExtractor={(c: Cell) => c.id}
        columnWrapperStyle={cols > 1 ? { gap: TILE_GAP } : undefined}
        contentContainerStyle={{ gap: TILE_GAP }}
        initialNumToRender={LIST_FIRST_BATCH}
        windowSize={LIST_WINDOW}
        renderItem={({ item }) =>
          'spacer' in item ? (
            <View style={{ flex: 1, minWidth: ROOM_TILE_MIN_WIDTH }} />
          ) : (
            <RoomTile room={item} onPress={setOpened} testID={`room-tile-${item.id}`} />
          )
        }
        ListEmptyComponent={empty}
      />
    );
  } else
    list = (
      <FlatList
        data={shown}
        style={{ flex: 1 }}
        initialNumToRender={LIST_FIRST_BATCH}
        windowSize={LIST_WINDOW}
        keyExtractor={(r: Room) => r.id}
        renderItem={({ item }) => <RoomRow room={item} today={today} onPress={setOpened} />}
        ListEmptyComponent={empty}
      />
    );

  return (
    <Screen
      width={wide ? 'panel' : 'form'}
      header={
        <Header
          title="Rooms"
          right={<IconButton icon={UserRound} accessibilityLabel="Account" onPress={openAccount} />}
        />
      }
    >
      <View style={{ flex: 1, gap: space.s4 }}>
        {freshness !== null ? (
          <Text variant="bodySm" tone="textMuted" accessibilityLiveRegion="polite">
            {freshness}
          </Text>
        ) : null}
        <FilterChips
          label="Room status"
          value={filter}
          // Empty statuses hide, except All and the one in use (so it can be switched off).
          options={FILTERS.filter((f) => f === 'all' || f === filter || counts[f] > 0).map((f) => ({
            value: f,
            label: filterLabel(f),
            count: counts[f],
          }))}
          onChange={onFilterChange}
        />
        {list}
      </View>
      <RoomSheet room={live} onClose={close} onOpenBooking={onOpenBooking} />
    </Screen>
  );
}
