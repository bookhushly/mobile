import { DoorOpen } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { FlatList, View } from 'react-native';

import { useReassign, type Reassign } from '@/features/receptionist/hooks/useReassign';
import { useTicking } from '@/features/receptionist/hooks/useTicking';
import type { BookingRow, RoomRow } from '@/features/receptionist/schemas/desk';
import { guestName } from '@/features/receptionist/ui/GuestRow';
import { refusalText } from '@/features/receptionist/ui/refusalText';
import { space } from '@/shared/theme';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  ListRow,
  SectionHeader,
  SkeletonRows,
  Spinner,
  Sheet,
  Stack,
  Text,
} from '@/shared/ui';

type Props = {
  /** The booking to move; null keeps the sheet closed. */
  booking: BookingRow | null;
  onClose: () => void;
  /** The move went through: the booking as re-read (or as the server now has it). */
  onMoved: (booking: BookingRow) => void;
};

type Item =
  { kind: 'header'; key: string; label: string } | { kind: 'room'; key: string; room: RoomRow };

const floorLabel = (r: RoomRow) => (r.floor === null ? 'No floor' : `Floor ${String(r.floor)}`);
export const roomLabel = (r: RoomRow) => {
  const type = r.hotel_room_types?.name;
  const n = `Room ${String(r.room_number)}`;
  return type === undefined || type === '' ? n : `${n} · ${type}`;
};

// Candidates keep the domain order (same type first, then by place); a header opens each floor
// run, and one marks where the other room types begin.
export function listItems(candidates: readonly RoomRow[], sameTypeId: string | null): Item[] {
  const items: Item[] = [];
  let floor: string | null = null;
  let other = false;
  for (const r of candidates) {
    const isOther = sameTypeId !== null && r.room_type_id !== sameTypeId;
    if (isOther && !other) {
      other = true;
      floor = null;
      items.push({ kind: 'header', key: 'other', label: 'Other room types' });
    }
    const f = floorLabel(r);
    if (f !== floor) {
      floor = f;
      items.push({ kind: 'header', key: `${other ? 'o' : 's'}-${f}`, label: f });
    }
    items.push({ kind: 'room', key: r.id, room: r });
  }
  return items;
}

const secondsLeft = (untilMs: number | null, nowMs: number) =>
  untilMs === null ? 0 : Math.max(0, Math.ceil((untilMs - nowMs) / 1000));

type BodyProps = { booking: BookingRow; r: Reassign; now: number; onClose: () => void };

function Body({ booking, r, now, onClose }: BodyProps) {
  const { state } = r;
  const name = guestName(booking);
  if (state.step === 'pick') {
    const items = listItems(r.candidates, r.sameTypeId);
    const taken =
      state.taken === null
        ? null
        : refusalText(
            { kind: 'roomTaken' },
            { act: 'reassign', roomNumber: state.taken.room_number },
          );
    let list: ReactNode;
    if (r.loading) list = <SkeletonRows count={5} />;
    else if (r.error)
      list = (
        <ErrorState
          title="Couldn't load rooms"
          message="Check the connection and try again."
          onRetry={r.refetchRooms}
        />
      );
    else
      list = (
        <FlatList
          data={items}
          style={{ flex: 1 }}
          keyExtractor={(i: Item) => i.key}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <SectionHeader label={item.label} />
            ) : (
              <ListRow
                title={roomLabel(item.room)}
                onPress={() => {
                  r.choose(item.room);
                }}
              />
            )
          }
          ListEmptyComponent={
            <EmptyState
              icon={DoorOpen}
              title="No free rooms right now"
              message="Mark a cleaned room as available on the Rooms tab."
            />
          }
        />
      );
    return (
      <View style={{ flex: 1, gap: space.s4 }}>
        {taken !== null ? <Banner tone={taken.tone} message={taken.message} /> : null}
        {list}
      </View>
    );
  }

  const room = `Room ${String(state.room.room_number)}`;
  const question = (
    <Text variant="titleLg" accessibilityRole="header">
      {`Move ${name} to ${room}?`}
    </Text>
  );
  switch (state.step) {
    case 'confirm':
    case 'sending':
      return (
        <Stack gap="s4">
          {question}
          {state.step === 'confirm' && state.notDone ? (
            <Banner tone="neutral" message="The move hasn't gone through yet. You can try again." />
          ) : null}
          <Text variant="body" tone="textSecondary">
            {`The booking's room becomes ${room}. ${name}'s old room is freed.`}
          </Text>
        </Stack>
      );
    case 'uncertain':
      return (
        <Stack gap="s4">
          {question}
          <Banner tone="neutral" message="Couldn't confirm the move." live="assertive" />
        </Stack>
      );
    case 'rechecking':
      return (
        <View style={{ alignItems: 'center', gap: space.s3, paddingVertical: space.s6 }}>
          <Spinner label="Checking" />
          <Text variant="body" tone="textSecondary">
            Checking…
          </Text>
        </View>
      );
    case 'rateLimited': {
      const s = secondsLeft(state.untilMs, now);
      return (
        <Stack gap="s4">
          {question}
          <Banner
            tone="neutral"
            message={
              s > 0
                ? `This hotel's network is sending too many requests — try again in ${String(s)} s.`
                : "This hotel's network is sending too many requests — try again in a moment."
            }
          />
        </Stack>
      );
    }
    case 'refused': {
      const t = refusalText(state.refusal, { act: 'reassign', roomNumber: state.room.room_number });
      return (
        <Stack gap="s4">
          {question}
          <Banner tone={t.tone} message={t.message} live="assertive" />
          <Button variant="secondary" label="Close" onPress={onClose} />
        </Stack>
      );
    }
  }
}

function footerFor(r: Reassign, nowMs: number): ReactNode {
  const { state } = r;
  switch (state.step) {
    case 'pick':
    case 'rechecking':
    case 'refused':
      return undefined;
    case 'confirm':
    case 'sending':
    case 'rateLimited':
      return (
        <>
          <Button
            label="Move"
            loading={state.step === 'sending'}
            disabled={state.step === 'rateLimited' && secondsLeft(state.untilMs, nowMs) > 0}
            onPress={r.move}
          />
          {state.step === 'sending' ? null : (
            <Button variant="secondary" label="Cancel" onPress={r.back} />
          )}
        </>
      );
    case 'uncertain':
      return (
        <>
          <Button label="Check again" onPress={r.recheck} />
          <Button variant="secondary" label="Cancel" onPress={r.back} />
        </>
      );
  }
}

function Open({ booking, onClose, onMoved }: Props & { booking: BookingRow }) {
  const r = useReassign(booking, onMoved);
  const { state } = r;
  const busy = state.step === 'sending' || state.step === 'rechecking';
  // R17: the countdown ticks on the server clock while a 429 holds the button.
  const now = useTicking(state.step === 'rateLimited' && state.untilMs !== null);
  return (
    <Sheet
      visible
      title="Choose another room"
      onClose={onClose}
      closeDisabled={busy}
      testID="choose-room-sheet"
      footer={footerFor(r, now)}
    >
      <Body booking={booking} r={r} now={now} onClose={onClose} />
    </Sheet>
  );
}

// R9: free rooms (same type first, by floor) → confirm → PATCH reassign → hand the booking back.
export function ChooseRoomSheet({ booking, onClose, onMoved }: Props) {
  if (booking === null) return null;
  return <Open booking={booking} onClose={onClose} onMoved={onMoved} />;
}
