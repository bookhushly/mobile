import type { ReactNode } from 'react';
import { View } from 'react-native';

import { viewBooking } from '@/features/receptionist/domain/bookingState';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import {
  checkedOutText,
  useCheckOut,
  type CheckOut,
} from '@/features/receptionist/hooks/useCheckOut';
import { useTicking } from '@/features/receptionist/hooks/useTicking';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { secondsLeft } from '@/features/receptionist/ui/ChooseRoomPanel';
import { guestName, nightsLabel, roomLine } from '@/features/receptionist/ui/GuestRow';
import { refusalText } from '@/features/receptionist/ui/refusalText';
import { warningText } from '@/features/receptionist/ui/warningText';
import { lagosWhen, stayRange, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Banner, Button, Sheet, Spinner, Stack, SuccessMark, Text, useAnnounce } from '@/shared/ui';

type Props = {
  /** The in-house booking to check out; null keeps the sheet closed. */
  booking: BookingRow | null;
  onClose: () => void;
};

const TOO_MANY = "This hotel's network is sending too many requests";
const firstName = (b: BookingRow) => guestName(b).split(' ')[0] ?? 'guest';

// Guest, room and stay. While the check-out is still to come (`pending`), also the R15 early-leave
// note and what will happen to the room; once it is settled (refused, elsewhere) neither applies.
function Summary({
  booking,
  today,
  pending,
}: {
  booking: BookingRow;
  today: IsoDate;
  pending: boolean;
}) {
  const view = viewBooking(booking, today);
  const room = pending ? booking.hotel_rooms : null;
  return (
    <Stack gap="s4">
      {(pending ? view.warnings : []).map((w) => (
        <Banner key={w.kind} tone="info" message={warningText(w)} />
      ))}
      <Stack gap="s1">
        <Text variant="titleLg">{guestName(booking)}</Text>
        <Text variant="body" tone="textSecondary">
          {roomLine(booking)}
        </Text>
        <Text variant="body" tone="textSecondary" tabular>
          {`${stayRange(booking.check_in_date, booking.check_out_date)} · ${nightsLabel(view.nights)}`}
        </Text>
      </Stack>
      {room === null ? null : (
        <Text variant="body">{`Room ${String(room.room_number)} will be marked dirty.`}</Text>
      )}
    </Stack>
  );
}

function step(
  c: CheckOut,
  booking: BookingRow,
  today: IsoDate,
  now: number,
  onClose: () => void,
): { body: ReactNode; footer: ReactNode } {
  const { state } = c;
  const cancel = <Button variant="secondary" label="Cancel" onPress={onClose} />;
  const done = <Button label="Done" onPress={onClose} />;
  const withBanner = (banner: ReactNode) => (
    <Stack gap="s4">
      {banner}
      <Summary
        booking={booking}
        today={today}
        pending={state.step !== 'refused' && state.step !== 'elsewhere'}
      />
    </Stack>
  );
  switch (state.step) {
    case 'confirm':
    case 'sending':
      return {
        body: withBanner(
          state.step === 'confirm' && state.notDone ? (
            <Banner
              tone="neutral"
              message="The check-out hasn't gone through yet. You can try again."
            />
          ) : null,
        ),
        footer: (
          <>
            <Button label="Check out" loading={state.step === 'sending'} onPress={c.confirm} />
            {state.step === 'sending' ? null : cancel}
          </>
        ),
      };
    case 'rateLimited': {
      const s = secondsLeft(state.untilMs, now);
      return {
        body: withBanner(
          <Banner
            tone="neutral"
            message={
              s > 0
                ? `${TOO_MANY} — try again in ${String(s)} s.`
                : `${TOO_MANY} — try again in a moment.`
            }
          />,
        ),
        footer: (
          <>
            <Button label="Check out" disabled={s > 0} onPress={c.confirm} />
            {cancel}
          </>
        ),
      };
    }
    case 'uncertain':
      return {
        body: withBanner(
          <Banner
            tone="neutral"
            message="Couldn't confirm the check-out. It may have gone through."
            live="assertive"
          />,
        ),
        footer: (
          <>
            <Button label="Check again" onPress={c.recheck} />
            {cancel}
          </>
        ),
      };
    case 'rechecking':
      return {
        body: (
          <View style={{ alignItems: 'center', gap: space.s3, paddingVertical: space.s8 }}>
            <Spinner label="Checking…" />
            <Text variant="body" tone="textSecondary">
              Checking…
            </Text>
          </View>
        ),
        footer: undefined,
      };
    case 'refused': {
      const t = refusalText(state.refusal, { act: 'checkOut', today });
      return {
        body: withBanner(<Banner tone={t.tone} message={t.message} live="assertive" />),
        footer: <Button variant="secondary" label="Close" onPress={onClose} />,
      };
    }
    case 'elsewhere': {
      const at = state.booking.checked_out_at;
      const when = at === null ? '' : lagosWhen(at, today);
      return {
        body: withBanner(
          <Banner
            tone="info"
            message={
              when === ''
                ? 'Already checked out (by another desk or device).'
                : `Already checked out ${when} (by another desk or device).`
            }
            live="assertive"
          />,
        ),
        footer: done,
      };
    }
    case 'done':
      return {
        body: (
          <View style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s6 }}>
            <SuccessMark animate />
            <Text variant="titleLg" align="center" accessibilityRole="header">
              {checkedOutText(state.booking)}
            </Text>
            <Text variant="body" tone="textSecondary" align="center">
              {guestName(state.booking)}
            </Text>
          </View>
        ),
        footer: done,
      };
  }
}

function Open({ booking, onClose }: Props & { booking: BookingRow }) {
  const { today } = useDesk();
  const c = useCheckOut(booking);
  const { state } = c;
  // R17: tick on the server clock while a 429 holds the button.
  const now = useTicking(state.step === 'rateLimited' && state.untilMs !== null);
  useAnnounce(state.step === 'done' ? 'Checked out' : null);
  const close = () => {
    c.settle();
    onClose();
  };
  const { body, footer } = step(c, booking, today, now, close);
  return (
    <Sheet
      visible
      title={state.step === 'done' ? 'Checked out' : `Check out ${firstName(booking)}`}
      onClose={close}
      closeDisabled={state.step === 'sending' || state.step === 'rechecking'}
      scroll
      testID="check-out-sheet"
      footer={footer}
    >
      {body}
    </Sheet>
  );
}

// R16 for check-out: confirm → one POST → done / refusal / uncertain → re-read (R3). Opened by
// the Booking screen and the Guests two-pane as its own sheet, never from inside another sheet.
export function CheckOutSheet({ booking, onClose }: Props) {
  if (booking === null) return null;
  return <Open booking={booking} onClose={onClose} />;
}
