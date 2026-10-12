import type { ReactNode } from 'react';
import { View } from 'react-native';

import { isInHouse, viewBooking } from '@/features/receptionist/domain/bookingState';
import type { FlowState } from '@/features/receptionist/domain/checkInFlow';
import { checkedInText, type CheckInFlow } from '@/features/receptionist/hooks/useCheckIn';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { BookingSummary } from '@/features/receptionist/ui/BookingSummary';
import { CheckInEntry, type EntryTab } from '@/features/receptionist/ui/CheckInEntry';
import { secondsLeft } from '@/features/receptionist/ui/ChooseRoomPanel';
import { guestName } from '@/features/receptionist/ui/GuestRow';
import { refusalText } from '@/features/receptionist/ui/refusalText';
import { warningText } from '@/features/receptionist/ui/warningText';
import { daysBetween, lagosTime, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Banner, Button, Spinner, Stack, SuccessMark, Text } from '@/shared/ui';

const ENTRY_ERROR = {
  empty: "Enter the guest's 8-character code.",
  shape: 'Check-in codes are 8 letters and numbers.',
  eventTicket: "That's an event ticket, not a hotel check-in code.",
} as const;

const firstName = (b: BookingRow) => guestName(b).split(' ')[0] ?? 'guest';

export function checkInTitle(s: FlowState): string {
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

// R16. The early-arrival note comes from the dates, not `viewBooking`: after a re-read proved the
// check-in the booking is already in house and would carry no arrival warning.
function Done({ booking, today }: { booking: BookingRow; today: IsoDate }) {
  const days = daysBetween(today, booking.check_in_date);
  return (
    <View style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s6 }}>
      <SuccessMark animate />
      <Text variant="titleLg" align="center" accessibilityRole="header">
        {checkedInText(booking)}
      </Text>
      <Text variant="body" tone="textSecondary" align="center">
        {guestName(booking)}
      </Text>
      {days > 0 ? (
        <Text variant="bodySm" tone="textSecondary" align="center">
          {warningText({ kind: 'earlyArrival', days, date: booking.check_in_date })}
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

const TOO_MANY = "This hotel's network is sending too many requests";

export type StepProps = {
  flow: CheckInFlow;
  hotelName: string;
  today: IsoDate;
  /** Server clock, ticking while a 429 holds the button (R17). */
  now: number;
  visible: boolean;
  tab: EntryTab;
  onTab: (tab: EntryTab) => void;
  value: string;
  onChangeValue: (v: string) => void;
  onScan: (raw: string) => void;
  onChooseRoom: () => void;
  onClose: () => void;
};

// Body and pinned footer for each step of the check-in flow (spec §4 copy).
export function checkInStep(p: StepProps): { body: ReactNode; footer: ReactNode } {
  const { flow, today } = p;
  const { state } = flow;
  const find = () => {
    flow.submit(p.value);
  };
  const cancel = <Button variant="secondary" label="Cancel" onPress={p.onClose} />;
  const done = <Button label="Done" onPress={p.onClose} />;

  switch (state.step) {
    case 'entry':
    case 'notFound': {
      const error = state.step === 'entry' ? state.error : null;
      return {
        body: (
          <Stack gap="s4">
            {state.step === 'notFound' ? (
              <Banner
                tone="warning"
                message={`No booking with code ${state.code} at ${p.hotelName}. Check the code with the guest.`}
                live="assertive"
              />
            ) : null}
            <CheckInEntry
              tab={p.tab}
              onTab={p.onTab}
              value={p.value}
              onChangeValue={p.onChangeValue}
              error={error === null ? null : ENTRY_ERROR[error]}
              onFind={find}
              // Still scanning after "no booking": the desk tries the next code without a tap.
              cameraOn={p.visible}
              onScan={p.onScan}
            />
          </Stack>
        ),
        footer: p.tab === 'type' ? <Button label="Find booking" onPress={find} /> : undefined,
      };
    }
    case 'looking':
      return { body: <Waiting text="Finding booking…" />, footer: undefined };
    case 'lookupFailed':
      return {
        body: (
          <Banner
            tone="neutral"
            message="Couldn't look up the code. Check the connection and try again."
            live="assertive"
          />
        ),
        footer: (
          <Button
            label="Try again"
            onPress={() => {
              flow.submit(state.code);
            }}
          />
        ),
      };
    case 'preview':
    case 'sending': {
      const b = state.booking;
      const view = viewBooking(b, today);
      const inHouse = isInHouse(b)
        ? refusalText({ kind: 'alreadyIn', at: b.checked_in_at })
        : null;
      const notReady = view.warnings.some((w) => w.kind === 'roomNotReady');
      return {
        body: (
          <WithSummary
            booking={b}
            today={today}
            banner={
              inHouse === null ? null : <Banner tone={inHouse.tone} message={inHouse.message} />
            }
          />
        ),
        footer: (
          <>
            {flow.canConfirm ? (
              <Button label="Check in" loading={state.step === 'sending'} onPress={flow.confirm} />
            ) : null}
            {flow.canConfirm && notReady && state.step === 'preview' ? (
              <Button variant="secondary" label="Choose another room" onPress={p.onChooseRoom} />
            ) : null}
            {state.step === 'sending' ? null : cancel}
          </>
        ),
      };
    }
    case 'refused': {
      const t = refusalText(state.refusal, {
        roomNumber: state.booking.hotel_rooms?.room_number,
      });
      return {
        body: (
          <WithSummary
            booking={state.booking}
            today={today}
            banner={
              <Banner
                tone={t.tone}
                message={t.message}
                live="assertive"
                action={
                  t.chooseRoom ? { label: 'Choose another room', onPress: p.onChooseRoom } : undefined
                }
              />
            }
          />
        ),
        footer: cancel,
      };
    }
    case 'rateLimited': {
      const s = secondsLeft(state.untilMs, p.now);
      return {
        body: (
          <WithSummary
            booking={state.booking}
            today={today}
            banner={
              <Banner
                tone="neutral"
                message={
                  s > 0 ? `${TOO_MANY} — try again in ${String(s)} s.` : `${TOO_MANY} — try again in a moment.`
                }
              />
            }
          />
        ),
        footer: (
          <>
            {flow.canConfirm ? (
              <Button label="Check in" disabled={s > 0} onPress={flow.confirm} />
            ) : null}
            {cancel}
          </>
        ),
      };
    }
    case 'uncertain':
      return {
        body: (
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
        ),
        footer: (
          <>
            <Button label="Check again" onPress={flow.recheck} />
            {cancel}
          </>
        ),
      };
    case 'rechecking':
      return { body: <Waiting text="Checking…" />, footer: undefined };
    case 'done':
      return { body: <Done booking={state.booking} today={today} />, footer: done };
    case 'elsewhere': {
      const at = state.booking.checked_in_at;
      const when = at === null ? '' : lagosTime(at);
      return {
        body: (
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
        ),
        footer: done,
      };
    }
  }
}
