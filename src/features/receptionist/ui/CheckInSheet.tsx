import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { isInHouse, viewBooking } from '@/features/receptionist/domain/bookingState';
import type { FlowState } from '@/features/receptionist/domain/checkInFlow';
import { checkedInText, useCheckIn } from '@/features/receptionist/hooks/useCheckIn';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useTicking } from '@/features/receptionist/hooks/useTicking';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { BookingSummary } from '@/features/receptionist/ui/BookingSummary';
import { CheckInEntry, type EntryTab } from '@/features/receptionist/ui/CheckInEntry';
import { ChooseRoomSheet } from '@/features/receptionist/ui/ChooseRoomSheet';
import { guestName } from '@/features/receptionist/ui/GuestRow';
import { refusalText } from '@/features/receptionist/ui/refusalText';
import { warningText } from '@/features/receptionist/ui/warningText';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { lagosTime } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Banner, Button, Sheet, Spinner, Stack, SuccessMark, Text, useAnnounce } from '@/shared/ui';

export type CheckInRequest = { id: number; code: string | null };

type Props = {
  visible: boolean;
  /** A new id per open; with a code the booking is looked up at once (Booking screen path). */
  request: CheckInRequest;
  onClose: () => void;
  /** 401 after refresh: the route layout runs the app's sign-out (features can't import auth). */
  onSignedOut: () => void;
};

const ENTRY_ERROR = {
  empty: "Enter the guest's 8-character code.",
  shape: 'Check-in codes are 8 letters and numbers.',
  eventTicket: "That's an event ticket, not a hotel check-in code.",
} as const;

const firstName = (b: BookingRow) => guestName(b).split(' ')[0] ?? 'guest';
const secondsLeft = (untilMs: number | null, nowMs: number) =>
  untilMs === null ? 0 : Math.max(0, Math.ceil((untilMs - nowMs) / 1000));

function titleFor(s: FlowState): string {
  switch (s.step) {
    case 'entry':
    case 'looking':
    case 'notFound':
    case 'lookupFailed':
      return 'Check in a guest';
    case 'done':
      return 'Checked in';
    case 'preview':
    case 'sending':
    case 'refused':
    case 'uncertain':
    case 'rechecking':
    case 'rateLimited':
    case 'elsewhere':
      return `Check in ${firstName(s.booking)}`;
  }
}

function Waiting({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', gap: space.s3, paddingVertical: space.s8 }}>
      <Spinner label={text} />
      <Text variant="body" tone="textSecondary">
        {text}
      </Text>
    </View>
  );
}

function Done({ booking, today }: { booking: BookingRow; today: IsoDate }) {
  const early = viewBooking(booking, today).warnings.find((w) => w.kind === 'earlyArrival');
  return (
    <View style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s6 }}>
      <SuccessMark animate />
      <Text variant="titleLg" align="center" accessibilityRole="header">
        {checkedInText(booking)}
      </Text>
      <Text variant="body" tone="textSecondary" align="center">
        {guestName(booking)}
      </Text>
      {early !== undefined ? (
        <Text variant="bodySm" tone="textSecondary" align="center">
          {warningText(early)}
        </Text>
      ) : null}
    </View>
  );
}

// The preview and everything that follows a confirm show the same summary with one banner.
function WithSummary({
  booking,
  today,
  banner,
}: {
  booking: BookingRow;
  today: IsoDate;
  banner: ReactNode;
}) {
  return (
    <Stack gap="s4">
      {banner}
      <BookingSummary
        booking={booking}
        view={viewBooking(booking, today)}
        testID="check-in-preview"
      />
    </Stack>
  );
}

// R13–R17: type or scan → preview → Check in → one of the §4 outcomes. Lives once in the
// receptionist layout; every "Check in" button opens it through `openCheckIn`.
export function CheckInSheet({ visible, request, onClose, onSignedOut }: Props) {
  const { hotel, today } = useDesk();
  const flow = useCheckIn(onSignedOut);
  const { state } = flow;
  const [tab, setTab] = useState<EntryTab>('type');
  const [value, setValue] = useState('');
  const [choosing, setChoosing] = useState(false);

  // A new open starts fresh (adjusting state during render, not in an effect). Starts unseen so
  // a sheet mounted already open with a code looks it up at once.
  const [seen, setSeen] = useState({ visible: false, id: visible ? -1 : request.id });
  if (seen.visible !== visible || seen.id !== request.id) {
    setSeen({ visible, id: request.id });
    setTab('type');
    setValue(request.code ?? '');
    setChoosing(false);
    flow.reset();
    if (visible && request.code !== null) flow.submit(request.code);
  }

  // One lookup per scanned value until the flow is back at entry (the camera decodes every frame).
  const scanned = useRef<string | null>(null);
  useEffect(() => {
    if (state.step === 'entry') scanned.current = null;
  }, [state.step]);

  // R17: tick on the server clock while a 429 holds the button.
  const now = useTicking(state.step === 'rateLimited' && state.untilMs !== null);

  useAnnounce(state.step === 'done' ? 'Checked in' : null);

  const busy = state.step === 'sending' || state.step === 'rechecking';
  const find = () => {
    flow.submit(value);
  };
  const cancel = <Button variant="secondary" label="Cancel" onPress={onClose} />;
  const done = <Button label="Done" onPress={onClose} />;
  const chooseRoom = (
    <Button
      variant="secondary"
      label="Choose another room"
      onPress={() => {
        setChoosing(true);
      }}
    />
  );

  let body: ReactNode;
  let footer: ReactNode;
  switch (state.step) {
    case 'entry':
    case 'notFound': {
      const error = state.step === 'entry' ? state.error : null;
      body = (
        <Stack gap="s4">
          {state.step === 'notFound' ? (
            <Banner
              tone="warning"
              message={`No booking with code ${state.code} at ${hotel.name}. Check the code with the guest.`}
              live="assertive"
            />
          ) : null}
          <CheckInEntry
            tab={tab}
            onTab={setTab}
            value={value}
            onChangeValue={setValue}
            error={error === null ? null : ENTRY_ERROR[error]}
            onFind={find}
            cameraOn={visible && state.step === 'entry'}
            onScan={(raw) => {
              if (scanned.current === raw) return;
              scanned.current = raw;
              flow.submit(raw);
            }}
          />
        </Stack>
      );
      footer = tab === 'type' ? <Button label="Find booking" onPress={find} /> : undefined;
      break;
    }
    case 'looking':
      body = <Waiting text="Finding booking…" />;
      break;
    case 'lookupFailed':
      body = (
        <Banner
          tone="neutral"
          message="Couldn't look up the code. Check the connection and try again."
          live="assertive"
        />
      );
      footer = (
        <Button
          label="Try again"
          onPress={() => {
            flow.submit(state.code);
          }}
        />
      );
      break;
    case 'preview':
    case 'sending': {
      const b = state.booking;
      const view = viewBooking(b, today);
      const inHouse = isInHouse(b) ? refusalText({ kind: 'alreadyIn', at: b.checked_in_at }) : null;
      const notReady = view.warnings.some((w) => w.kind === 'roomNotReady');
      body = (
        <WithSummary
          booking={b}
          today={today}
          banner={
            inHouse === null ? null : <Banner tone={inHouse.tone} message={inHouse.message} />
          }
        />
      );
      footer = (
        <>
          {flow.canConfirm ? (
            <Button label="Check in" loading={state.step === 'sending'} onPress={flow.confirm} />
          ) : null}
          {flow.canConfirm && notReady && state.step === 'preview' ? chooseRoom : null}
          {state.step === 'sending' ? null : cancel}
        </>
      );
      break;
    }
    case 'refused': {
      const t = refusalText(state.refusal);
      body = (
        <WithSummary
          booking={state.booking}
          today={today}
          banner={
            <Banner
              tone={t.tone}
              message={t.message}
              live="assertive"
              action={
                t.chooseRoom
                  ? {
                      label: 'Choose another room',
                      onPress: () => {
                        setChoosing(true);
                      },
                    }
                  : undefined
              }
            />
          }
        />
      );
      footer = cancel;
      break;
    }
    case 'rateLimited': {
      const s = secondsLeft(state.untilMs, now);
      body = (
        <WithSummary
          booking={state.booking}
          today={today}
          banner={
            <Banner
              tone="neutral"
              message={
                s > 0
                  ? `This hotel's network is sending too many requests — try again in ${String(s)} s.`
                  : "This hotel's network is sending too many requests — try again in a moment."
              }
            />
          }
        />
      );
      footer = (
        <>
          {flow.canConfirm ? (
            <Button label="Check in" disabled={s > 0} onPress={flow.confirm} />
          ) : null}
          {cancel}
        </>
      );
      break;
    }
    case 'uncertain':
      body = (
        <WithSummary
          booking={state.booking}
          today={today}
          banner={
            <Banner
              tone="neutral"
              message="Couldn't confirm the check-in. It may have gone through."
              live="assertive"
            />
          }
        />
      );
      footer = (
        <>
          <Button label="Check again" onPress={flow.recheck} />
          {cancel}
        </>
      );
      break;
    case 'rechecking':
      body = <Waiting text="Checking…" />;
      break;
    case 'done':
      body = <Done booking={state.booking} today={today} />;
      footer = done;
      break;
    case 'elsewhere': {
      const at = state.booking.checked_in_at;
      const when = at === null ? '' : lagosTime(at);
      body = (
        <WithSummary
          booking={state.booking}
          today={today}
          banner={
            <Banner
              tone="info"
              message={
                when === ''
                  ? 'Already checked in (by another desk or device).'
                  : `Already checked in at ${when} (by another desk or device).`
              }
              live="assertive"
            />
          }
        />
      );
      footer = done;
      break;
    }
  }

  const booking = 'booking' in state ? state.booking : null;
  return (
    <>
      <Sheet
        visible={visible}
        title={titleFor(state)}
        onClose={onClose}
        closeDisabled={busy}
        scroll
        testID="check-in-sheet"
        footer={footer}
      >
        {body}
      </Sheet>
      <ChooseRoomSheet
        booking={choosing ? booking : null}
        onClose={() => {
          setChoosing(false);
        }}
        onMoved={(b) => {
          setChoosing(false);
          flow.bookingChanged(b);
        }}
      />
    </>
  );
}
