import { Circle, CircleDot } from 'lucide-react-native';
import { useState } from 'react';

import {
  canChangeStatus,
  SETTABLE_STATUSES,
  type SettableStatus,
} from '@/features/receptionist/domain/roomBoard';
import { useGuests } from '@/features/receptionist/hooks/useGuests';
import { useRoomStatus } from '@/features/receptionist/hooks/useRoomStatus';
import { useTicking } from '@/features/receptionist/hooks/useTicking';
import type { RoomRow } from '@/features/receptionist/schemas/desk';
import { secondsLeft } from '@/features/receptionist/ui/ChooseRoomPanel';
import { guestName } from '@/features/receptionist/ui/GuestRow';
import { roomTitle, roomTone, statusLabel } from '@/features/receptionist/ui/roomTone';
import {
  Banner,
  Button,
  Icon,
  ListRow,
  Sheet,
  Stack,
  StatusPill,
  Text,
  TextLink,
} from '@/shared/ui';

type Props = {
  /** The room as the board has it now; null keeps the sheet closed. */
  room: RoomRow | null;
  onClose: () => void;
  onOpenBooking: (bookingId: string) => void;
};

const TOO_MANY = "This hotel's network is sending too many requests";

// R18: an occupied room changes only through check-out; say who is in and link to them.
function Occupied({ room, onOpenBooking }: { room: RoomRow; onOpenBooking: (id: string) => void }) {
  const { lists } = useGuests();
  const guest = lists?.inHouse.find((b) => b.hotel_rooms?.id === room.id) ?? null;
  return (
    <Stack gap="s4">
      <Banner
        tone="info"
        message="A guest is checked in. Check them out first to change this room."
      />
      {guest === null ? null : (
        <Stack gap="s1">
          <Text variant="bodyStrong">{guestName(guest)}</Text>
          <TextLink
            label="Open booking"
            accessibilityLabel={`Open ${guestName(guest)}'s booking`}
            onPress={() => {
              onOpenBooking(guest.id);
            }}
          />
        </Stack>
      )}
    </Stack>
  );
}

function Settable({ room, onClose }: { room: RoomRow; onClose: () => void }) {
  const current: SettableStatus | null = room.status === 'occupied' ? null : room.status;
  const [selected, setSelected] = useState<SettableStatus | null>(current);
  const { state, save } = useRoomStatus(room, onClose);
  const now = useTicking(state.step === 'rateLimited' && state.untilMs !== null);

  let banner = null;
  if (state.step === 'retry')
    banner = <Banner tone="neutral" message={state.message} live="assertive" />;
  else if (state.step === 'refused')
    banner = <Banner tone={state.tone} message={state.message} live="assertive" />;
  else if (state.step === 'rateLimited') {
    const s = secondsLeft(state.untilMs, now);
    banner = (
      <Banner
        tone="neutral"
        message={
          s > 0
            ? `${TOO_MANY} — try again in ${String(s)} s.`
            : `${TOO_MANY} — try again in a moment.`
        }
      />
    );
  }
  const waiting = state.step === 'rateLimited' && secondsLeft(state.untilMs, now) > 0;
  const unchanged = selected === null || selected === current;

  return (
    <Sheet
      visible
      title={roomTitle(room)}
      onClose={onClose}
      closeDisabled={state.step === 'sending'}
      scroll
      testID="room-sheet"
      footer={
        state.step === 'refused' ? (
          <Button variant="secondary" label="Close" onPress={onClose} />
        ) : (
          <Button
            label={state.step === 'retry' ? 'Try again' : 'Save'}
            loading={state.step === 'sending'}
            disabled={unchanged || waiting}
            onPress={() => {
              if (selected !== null) save(selected);
            }}
          />
        )
      }
    >
      <Stack gap="s4">
        <StatusPill tone={roomTone(room.status)} label={statusLabel(room.status)} />
        {banner}
        {state.step === 'refused' ? null : (
          <Stack gap="s1">
            <Text variant="label" tone="textSecondary" accessibilityRole="header">
              Mark as
            </Text>
            {SETTABLE_STATUSES.map((s) => (
              <ListRow
                key={s}
                title={statusLabel(s)}
                checked={selected === s}
                leading={
                  <Icon as={selected === s ? CircleDot : Circle} size="md" tone="textPrimary" />
                }
                onPress={() => {
                  setSelected(s);
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Sheet>
  );
}

// Spec §3 Room sheet: current status, the in-house guest when occupied, otherwise a radio list of
// the statuses the desk may set and **Save**. Opened from the Rooms screen only.
export function RoomSheet({ room, onClose, onOpenBooking }: Props) {
  if (room === null) return null;
  if (!canChangeStatus(room))
    return (
      <Sheet visible title={roomTitle(room)} onClose={onClose} scroll testID="room-sheet">
        <Stack gap="s4">
          <StatusPill tone={roomTone(room.status)} label={statusLabel(room.status)} />
          <Occupied room={room} onOpenBooking={onOpenBooking} />
        </Stack>
      </Sheet>
    );
  return <Settable room={room} onClose={onClose} />;
}
