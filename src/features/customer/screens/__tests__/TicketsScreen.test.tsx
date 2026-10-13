import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions } from 'react-native';

import type { LiveCodeState } from '@/features/customer/domain/liveCode';
import { fromEvent } from '@/features/customer/domain/myBookings';
import { useBooking } from '@/features/customer/hooks/useBooking';
import { useLiveCode } from '@/features/customer/hooks/useLiveCode';
import type { WalletEntry } from '@/features/customer/offline/wallet';
import type { EventBookingRow } from '@/features/customer/schemas/bookings';
import { TicketsScreen } from '@/features/customer/screens/TicketsScreen';
import { useBrightScreen } from '@/shared/platform/useBrightScreen';

import { ev, NOON, TODAY } from '../../hooks/__tests__/customerTestUtils';

jest.mock('@/features/customer/hooks/useBooking', () => ({ useBooking: jest.fn() }));
jest.mock('@/features/customer/hooks/useLiveCode', () => ({ useLiveCode: jest.fn() }));
jest.mock('@/shared/platform/useBrightScreen', () => ({ useBrightScreen: jest.fn() }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
// Fake timers move Date.now(); the server clock follows it.
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => Date.now() } }));

const mockBooking = jest.mocked(useBooking);
const mockLive = jest.mocked(useLiveCode);
const mockBright = jest.mocked(useBrightScreen);

const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';
const T1 = 'a1b2c3d4-0000-4000-8000-000000000001';
const T2 = 'b2c3d4e5-0000-4000-8000-000000000002';
const T3 = 'c3d4e5f6-0000-4000-8000-000000000003';
const LIVE: LiveCodeState = { kind: 'live', token: 'tok-1', expiresAt: NOON + 20_000 };

const retry = jest.fn();
let states: Record<string, LiveCodeState> = {};

function threeTickets(p: Partial<EventBookingRow> = {}): EventBookingRow {
  return ev({
    id: ID,
    tickets: [
      { id: T1, ticket_type: 'VIP', ticket_index: 1, checked_in_at: null },
      { id: T2, ticket_type: 'VIP', ticket_index: 2, checked_in_at: null },
      { id: T3, ticket_type: 'Regular', ticket_index: 3, checked_in_at: null },
    ],
    ...p,
  });
}
function oneTicket(p: Partial<EventBookingRow> = {}): EventBookingRow {
  return ev({
    id: ID,
    tickets: [{ id: T1, ticket_type: 'VIP', ticket_index: 1, checked_in_at: null }],
    ...p,
  });
}

function loaded(over: Partial<ReturnType<typeof useBooking>>) {
  mockBooking.mockReturnValue({
    row: undefined,
    fromWallet: null,
    savedAt: null,
    today: TODAY,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    ...over,
  });
}

async function show(index?: string) {
  await render(<TicketsScreen userId="u1" bookingId={ID} index={index} onClose={jest.fn()} />);
}

/** Ticket ids whose latest useLiveCode call was active. */
function polling(): string[] {
  const last = new Map<string | null, boolean>();
  for (const [id, active] of mockLive.mock.calls) last.set(id, active);
  return [...last].filter(([, a]) => a).map(([id]) => String(id));
}

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  // Fake timers: FlatList's batching timer and the live clock stay inside act().
  jest.useFakeTimers({ now: NOON });
  jest.clearAllMocks();
  states = {};
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  mockLive.mockImplementation((id) => ({
    state: (id === null ? undefined : states[id]) ?? { kind: 'loading' },
    retry,
  }));
});

// The ring and the ticking digits are hidden from screen readers; find them anyway.
const hidden = { includeHiddenElements: true };

it('polls only the ticket on screen, and swiping moves the poll', async () => {
  loaded({ row: threeTickets() });
  await show();
  expect(polling()).toEqual([T1]);
  const { width } = Dimensions.get('window');
  await fireEvent(screen.getByTestId('ticket-pager'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: width, y: 0 } },
  });
  expect(polling()).toEqual([T2]);
  await fireEvent.press(screen.getByRole('button', { name: 'Next ticket' }));
  expect(polling()).toEqual([T3]);
  expect(screen.getByRole('button', { name: 'Next ticket' })).toBeDisabled();
});

it('opens on the page in the index param, and ignores a bad one', async () => {
  loaded({ row: threeTickets() });
  await show('1');
  expect(polling()).toEqual([T2]);
  mockLive.mockClear();
  await show('7');
  expect(polling()).toEqual([T1]);
});

it('live: the code, its line, a countdown ring and a running server clock', async () => {
  states = { [T1]: LIVE };
  loaded({ row: oneTicket({ seat_assignments: [{ seat: 'A12' }] }) });
  await show();
  expect(screen.getByLabelText('Ticket 1 of 1 code')).toBeTruthy();
  expect(screen.getByText('VIP · Ticket 1 of 1 · Seat A12')).toBeTruthy();
  expect(screen.getByText('Live code · refreshes every 30 s')).toBeTruthy();
  expect(screen.getByTestId('countdown-ring-sweep', hidden)).toBeTruthy();
  expect(screen.getByLabelText('Live ticket')).toBeTruthy();
  expect(screen.getByText('12:00:00', hidden)).toBeTruthy();
  await act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByText('12:00:01', hidden)).toBeTruthy();
  // No reference text under a live code (the token is long).
  expect(screen.queryByText('A1B2C3D4')).toBeNull();
  expect(mockBright).toHaveBeenLastCalledWith(true);
});

it('Reduce Motion: a still ring with the seconds left as text', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  states = { [T1]: LIVE };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.getByTestId('countdown-ring-static', hidden)).toBeTruthy();
  expect(screen.getByText('20', hidden)).toBeTruthy();
  await act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(screen.getByText('17', hidden)).toBeTruthy();
});

it('rate limited with a usable code keeps showing it', async () => {
  states = {
    [T1]: { kind: 'rateLimited', retryAfterSec: 10, last: { token: 'tok-0', expiresAt: NOON } },
  };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.getByLabelText('Ticket 1 of 1 code')).toBeTruthy();
  expect(screen.getByText('Refreshing shortly')).toBeTruthy();
});

it('fallback, printed codes allowed: the static code with its reference and a neutral note', async () => {
  states = { [T1]: { kind: 'fallback' } };
  const row = oneTicket();
  loaded({
    row: { ...row, listing: row.listing && { ...row.listing, require_dynamic_ticket: false } },
  });
  await show();
  expect(screen.getByLabelText('Ticket 1 of 1 code')).toBeTruthy();
  expect(screen.getByText('A1B2C3D4')).toBeTruthy();
  expect(screen.getByText('Offline code — it works at the door')).toBeTruthy();
  expect(screen.queryByText(/Connect to the internet/)).toBeNull();
});

it.each<[string, Partial<EventBookingRow>]>([
  ['live-only', {}],
  ['hidden listing', { listing: null }],
])('fallback, %s: no QR, a connect banner and Try again', async (_, over) => {
  states = { [T1]: { kind: 'fallback' } };
  loaded({ row: oneTicket(over) });
  await show();
  expect(screen.queryByLabelText('Ticket 1 of 1 code')).toBeNull();
  expect(screen.queryByText('Offline code — it works at the door')).toBeNull();
  expect(
    screen.getByText(
      'Connect to the internet to show this ticket. This event only accepts live codes.',
    ),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('admitted: the time, no QR', async () => {
  states = { [T1]: { kind: 'admitted', at: '2026-10-13T18:42:00Z' } };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.getByText('Admitted at 19:42')).toBeTruthy();
  expect(screen.queryByLabelText('Ticket 1 of 1 code')).toBeNull();
});

it('a ticket already admitted on the booking never polls', async () => {
  loaded({
    row: ev({
      id: ID,
      tickets: [
        { id: T1, ticket_type: 'VIP', ticket_index: 1, checked_in_at: '2026-10-13T18:42:00Z' },
      ],
    }),
  });
  await show();
  expect(mockLive).toHaveBeenLastCalledWith(null, false);
  expect(screen.getByText('Admitted at 19:42')).toBeTruthy();
});

it.each<[LiveCodeState, string]>([
  [{ kind: 'notConfirmed' }, "This booking isn't confirmed yet"],
  [{ kind: 'notYours' }, "This ticket isn't on your account"],
])('refusals say so without a QR (%j)', async (state, text) => {
  states = { [T1]: state };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryByLabelText('Ticket 1 of 1 code')).toBeNull();
});

it('offline: the saved tickets with a note; an unknown live-only flag shows no static QR', async () => {
  states = { [T1]: { kind: 'fallback' } };
  const entry: WalletEntry = {
    ...fromEvent(oneTicket(), TODAY),
    tickets: [{ id: T1, index: 1, total: 1, type: 'VIP', seat: null, admittedAt: null }],
  };
  loaded({ fromWallet: entry, savedAt: Date.parse('2026-10-13T09:42:00Z') });
  await show();
  expect(screen.getByText('Afrobeats night')).toBeTruthy();
  expect(screen.getByText('Showing saved tickets — last updated 10:42.')).toBeTruthy();
  expect(screen.queryByLabelText('Ticket 1 of 1 code')).toBeNull();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});

it('no tickets yet, not yours, failed and bad ids never brighten the screen', async () => {
  loaded({ row: threeTickets({ tickets: [] }) });
  await show();
  expect(screen.getByText('Your tickets are being issued')).toBeTruthy();
  expect(mockBright).toHaveBeenLastCalledWith(false);
  loaded({ row: null });
  await show();
  expect(screen.getByText("This booking isn't on your account")).toBeTruthy();
  loaded({ error: true });
  await show();
  expect(screen.getByText("Couldn't load your tickets")).toBeTruthy();
  expect(mockBright).not.toHaveBeenCalledWith(true);
  mockBooking.mockClear();
  await render(
    <TicketsScreen userId="u1" bookingId={null} index={undefined} onClose={jest.fn()} />,
  );
  expect(screen.getByText("This booking isn't on your account")).toBeTruthy();
  expect(mockBooking).not.toHaveBeenCalled();
});
