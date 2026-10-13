import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, FlatList } from 'react-native';

import type { LiveCodeState } from '@/features/customer/domain/liveCode';
import { fromEvent } from '@/features/customer/domain/myBookings';
import { useBooking } from '@/features/customer/hooks/useBooking';
import { useLiveCode } from '@/features/customer/hooks/useLiveCode';
import type { WalletEntry } from '@/features/customer/offline/wallet';
import type { EventBookingRow } from '@/features/customer/schemas/bookings';
import { TicketsScreen } from '@/features/customer/screens/TicketsScreen';
import { useBrightScreen } from '@/shared/platform/useBrightScreen';
import { usePreventCapture } from '@/shared/platform/usePreventCapture';

import { ev, NOON, TODAY } from '../../hooks/__tests__/customerTestUtils';

jest.mock('@/features/customer/hooks/useBooking', () => ({ useBooking: jest.fn() }));
jest.mock('@/features/customer/hooks/useLiveCode', () => ({ useLiveCode: jest.fn() }));
const mockProfile: { name: string | null } = { name: 'Ada Obi' };
jest.mock('@/features/customer/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: mockProfile.name === null ? null : { name: mockProfile.name },
  }),
}));
jest.mock('@/shared/platform/useBrightScreen', () => ({ useBrightScreen: jest.fn() }));
jest.mock('@/shared/platform/usePreventCapture', () => ({ usePreventCapture: jest.fn() }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
// Fake timers move Date.now(); the server clock follows it.
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => Date.now() } }));

const mockBooking = jest.mocked(useBooking);
const mockLive = jest.mocked(useLiveCode);
const mockBright = jest.mocked(useBrightScreen);
const mockCapture = jest.mocked(usePreventCapture);

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

const signIn = jest.fn();

async function show(index?: string) {
  await render(
    <TicketsScreen
      userId="u1"
      bookingId={ID}
      index={index}
      onClose={jest.fn()}
      onSignIn={signIn}
    />,
  );
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
  mockProfile.name = 'Ada Obi';
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  mockLive.mockImplementation((id) => ({
    state: (id === null ? undefined : states[id]) ?? { kind: 'loading' },
    retry,
  }));
});

// The ring and the ticking digits are hidden from screen readers; find them anyway.
const hidden = { includeHiddenElements: true };

/** A plain scroll (no momentum event) that leaves page `i` filling the pager. */
async function scrollTo(i: number) {
  const { width } = Dimensions.get('window');
  const pager = screen.getByTestId('ticket-pager');
  const size = { width, height: 800 };
  await fireEvent(pager, 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...size } } });
  await fireEvent(pager, 'contentSizeChange', width * 3, 800);
  await fireEvent.scroll(pager, {
    nativeEvent: {
      contentOffset: { x: width * i, y: 0 },
      contentSize: { width: width * 3, height: 800 },
      layoutMeasurement: size,
    },
  });
}

/**
 * The pager renders one page first and the rest as the window moves (initialNumToRender 1,
 * windowSize 3). A device scrolls (and so renders) on every step; here: lay out at page `i`
 * and let the render batches run.
 */
async function settle(i: number) {
  await scrollTo(i);
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
}

it('polls only the ticket on screen, and swiping moves the poll', async () => {
  loaded({ row: threeTickets() });
  await show();
  expect(polling()).toEqual([T1]);
  await settle(0);
  const { width } = Dimensions.get('window');
  await fireEvent(screen.getByTestId('ticket-pager'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: width, y: 0 } },
  });
  expect(polling()).toEqual([T2]);
  await settle(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Next ticket' }));
  expect(polling()).toEqual([T3]);
  expect(screen.getByRole('button', { name: 'Next ticket' })).toBeDisabled();
});

it('a page that comes into view without momentum (slow drag, screen reader) goes live', async () => {
  loaded({ row: threeTickets() });
  await show();
  await settle(2);
  await scrollTo(2); // the next scroll frame, now that the page is drawn
  expect(polling()).toEqual([T3]);
  await scrollTo(1);
  expect(polling()).toEqual([T2]);
});

it('only the page on screen draws a code or reaches screen readers', async () => {
  states = { [T1]: LIVE, [T2]: LIVE, [T3]: { kind: 'fallback' } };
  const row = threeTickets();
  loaded({
    row: { ...row, listing: row.listing && { ...row.listing, require_dynamic_ticket: false } },
  });
  await show();
  // First paint: the page on screen only.
  expect(screen.queryByTestId('ticket-page-1', hidden)).toBeNull();
  await settle(0);
  expect(screen.getByLabelText('Ticket 1 of 3 code')).toBeTruthy();
  expect(screen.queryByLabelText('Ticket 2 of 3 code', hidden)).toBeNull();
  expect(screen.queryByLabelText('Ticket 3 of 3 code', hidden)).toBeNull();
  // Then its neighbour only (windowSize 3), never a code.
  expect(screen.getAllByTestId('ticket-placeholder', hidden)).toHaveLength(1);
  expect(screen.queryByTestId('ticket-page-2', hidden)).toBeNull();
  expect(screen.getByTestId('ticket-page-0').props.accessibilityElementsHidden).toBe(false);
  expect(screen.getByTestId('ticket-page-1', hidden).props.importantForAccessibility).toBe(
    'no-hide-descendants',
  );
  await scrollTo(1);
  expect(screen.getByLabelText('Ticket 2 of 3 code')).toBeTruthy();
  expect(screen.queryByLabelText('Ticket 1 of 3 code', hidden)).toBeNull();
});

it('Previous and Next step pages and say where the user landed', async () => {
  const say = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => {});
  loaded({ row: threeTickets() });
  await show();
  expect(say).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Previous ticket' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Next ticket' }));
  await settle(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Next ticket' }));
  expect(say).toHaveBeenLastCalledWith('Ticket 3 of 3');
  await settle(2);
  await fireEvent.press(screen.getByRole('button', { name: 'Previous ticket' }));
  expect(polling()).toEqual([T2]);
  expect(say).toHaveBeenLastCalledWith('Ticket 2 of 3');
  await fireEvent.press(screen.getByRole('button', { name: 'Previous ticket' }));
  expect(polling()).toEqual([T1]);
  expect(screen.getByRole('button', { name: 'Previous ticket' })).toBeDisabled();
});

it.each<[boolean, boolean]>([
  [false, true],
  [true, false],
])('stepping animates unless Reduce Motion is on (reduce %s)', async (reduce, animated) => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduce);
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset');
  loaded({ row: threeTickets() });
  await show();
  await fireEvent.press(screen.getByRole('button', { name: 'Next ticket' }));
  const { width } = Dimensions.get('window');
  expect(scroll).toHaveBeenLastCalledWith({ offset: width, animated });
  scroll.mockRestore();
});

it('a held live code past its use is never drawn', async () => {
  states = { [T1]: { kind: 'live', token: 'old', expiresAt: NOON - 31_000 } };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.queryByLabelText('Ticket 1 of 1 code')).toBeNull();
  expect(screen.getByLabelText('Loading ticket')).toBeTruthy();
});

it('blocks screenshots under the ticket key', async () => {
  loaded({ row: oneTicket() });
  await show();
  expect(mockCapture).toHaveBeenCalledWith('ticket-qr');
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
  expect(screen.getByText('Ada Obi · Ticket 1 of 1 · VIP · Seat A12')).toBeTruthy();
  expect(screen.getByText('Live code · refreshes every 30 s')).toBeTruthy();
  expect(screen.getByTestId('countdown-ring-sweep', hidden)).toBeTruthy();
  expect(screen.getByLabelText('Live ticket')).toBeTruthy();
  expect(screen.getByText('12:00:00 pm', hidden)).toBeTruthy();
  await act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByText('12:00:01 pm', hidden)).toBeTruthy();
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

it('fallback, printed codes allowed: the static code under the holder line, a neutral note, no id', async () => {
  states = { [T1]: { kind: 'fallback' } };
  const row = oneTicket();
  loaded({
    row: { ...row, listing: row.listing && { ...row.listing, require_dynamic_ticket: false } },
  });
  await show();
  expect(screen.getByLabelText('Ticket 1 of 1 code')).toBeTruthy();
  expect(screen.getByText('Ada Obi · Ticket 1 of 1 · VIP')).toBeTruthy();
  expect(screen.queryByText('A1B2C3D4')).toBeNull();
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

it('signed out, live-only: no QR, "sign in again" and a Sign in action', async () => {
  states = { [T1]: { kind: 'signedOut' } };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.queryByLabelText('Ticket 1 of 1 code')).toBeNull();
  expect(screen.getByText('Sign in again to show this ticket')).toBeTruthy();
  expect(screen.queryByText(/Connect to the internet/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(signIn).toHaveBeenCalledTimes(1);
});

it('signed out, printed codes allowed: the static code still shows', async () => {
  states = { [T1]: { kind: 'signedOut' } };
  const row = oneTicket();
  loaded({
    row: { ...row, listing: row.listing && { ...row.listing, require_dynamic_ticket: false } },
  });
  await show();
  expect(screen.getByLabelText('Ticket 1 of 1 code')).toBeTruthy();
  expect(screen.getByText('Offline code — it works at the door')).toBeTruthy();
  expect(screen.queryByText('Sign in again to show this ticket')).toBeNull();
});

it('no profile name (offline): the line starts with the ticket', async () => {
  mockProfile.name = null;
  states = { [T1]: LIVE };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.getByText('Ticket 1 of 1 · VIP')).toBeTruthy();
});

it('admitted on an earlier day says the date', async () => {
  states = { [T1]: { kind: 'admitted', at: '2026-10-10T18:42:00Z' } };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.getByText('Admitted on Sat 10 Oct at 7:42 pm')).toBeTruthy();
});

it('admitted: the time, no QR', async () => {
  states = { [T1]: { kind: 'admitted', at: '2026-10-13T18:42:00Z' } };
  loaded({ row: oneTicket() });
  await show();
  expect(screen.getByText('Admitted at 7:42 pm')).toBeTruthy();
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
  expect(screen.getByText('Admitted at 7:42 pm')).toBeTruthy();
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
  expect(screen.getByText('Showing saved tickets — last updated 10:42 am.')).toBeTruthy();
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
    <TicketsScreen
      userId="u1"
      bookingId={null}
      index={undefined}
      onClose={jest.fn()}
      onSignIn={jest.fn()}
    />,
  );
  expect(screen.getByText("This booking isn't on your account")).toBeTruthy();
  expect(mockBooking).not.toHaveBeenCalled();
});
