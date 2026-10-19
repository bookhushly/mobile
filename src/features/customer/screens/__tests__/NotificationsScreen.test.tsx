import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { customerDb } from '@/features/customer/api/customerDb';
import { fromEvent, splitBookings } from '@/features/customer/domain/myBookings';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import { NotificationsScreen, UNDO_MS } from '@/features/customer/screens/NotificationsScreen';
import type { NotificationRow } from '@/features/customer/schemas/notifications';
import { err, ok } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';
import { typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';

import { ev, makeQueryClient, note, TODAY } from '../../hooks/__tests__/customerTestUtils';

// The real useNotifications over a mocked db: the screen's rollbacks are the hook's (C13).
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/shared/supabase/client', () => ({
  supabase: { auth: { refreshSession: jest.fn(), updateUser: jest.fn() } },
}));
jest.mock('@/features/customer/api/customerDb', () => ({
  ...jest.requireActual<object>('@/features/customer/api/customerDb'),
  customerDb: {
    notifications: jest.fn(),
    unreadCount: jest.fn(),
    markRead: jest.fn(),
    markUnread: jest.fn(),
    markAllRead: jest.fn(),
    remove: jest.fn(),
  },
}));
jest.mock('@/features/customer/hooks/useMyBookings', () => ({ useMyBookings: jest.fn() }));
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
// An older deploy without read-all: "Mark all as read" takes the 4a RLS path.
jest.mock('@/features/customer/api/notificationsApi', () => ({
  readAllNotifications: () => Promise.resolve({ ok: true, value: { fallback: true } }),
}));
const mockNow = Date.parse('2026-10-13T11:00:00Z');

type Db = typeof customerDb;
let db: {
  notifications: jest.SpiedFunction<Db['notifications']>;
  markRead: jest.SpiedFunction<Db['markRead']>;
  markUnread: jest.SpiedFunction<Db['markUnread']>;
  markAllRead: jest.SpiedFunction<Db['markAllRead']>;
  remove: jest.SpiedFunction<Db['remove']>;
};
let refresh: jest.SpiedFunction<typeof supabase.auth.refreshSession>;

const booked = note('booked', {
  title: 'Booking confirmed',
  message: 'Your ticket for Afrobeats night is ready.',
  data: { bookingId: 'e1' },
  created_at: '2026-10-13T10:55:00Z',
});
const paid = note('paid', {
  type: 'payment_received',
  title: 'Payment received',
  read: true,
  link: '/dashboard/customer/profile',
  created_at: '2026-10-12T20:00:00Z',
});
const plain = note('plain', {
  type: 'system',
  title: 'Welcome to Bookhushly',
  created_at: '2026-10-10T09:00:00Z',
});

let qc = makeQueryClient();

function show(rows: NotificationRow[]) {
  db.notifications.mockResolvedValue(ok(rows));
}

async function open() {
  const h = { onBack: jest.fn(), onOpenBooking: jest.fn(), onOpenTab: jest.fn() };
  await render(
    <QueryClientProvider client={qc}>
      <NotificationsScreen userId="u1" {...h} />
    </QueryClientProvider>,
  );
  await waitFor(() => {
    expect(db.notifications).toHaveBeenCalled();
  });
  return h;
}

// The jest ScrollView mock keeps the RefreshControl element as a prop rather than rendering it.
async function pullToRefresh() {
  const list = screen.getByTestId('notifications-list');
  const control = (list.props as { refreshControl: { props: { onRefresh: () => void } } })
    .refreshControl;
  await act(async () => {
    control.props.onRefresh();
    await jest.advanceTimersByTimeAsync(0);
  });
}

// Fake timers: FlatList's cell-batching timer otherwise fires between act() scopes, and the
// Undo banner's 5 s runs on them.
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  qc = makeQueryClient();
  db = {
    notifications: jest.spyOn(customerDb, 'notifications').mockResolvedValue(ok([])),
    markRead: jest.spyOn(customerDb, 'markRead').mockResolvedValue(ok(1)),
    markUnread: jest.spyOn(customerDb, 'markUnread').mockResolvedValue(ok(1)),
    markAllRead: jest.spyOn(customerDb, 'markAllRead').mockResolvedValue(ok(2)),
    remove: jest.spyOn(customerDb, 'remove').mockResolvedValue(ok(1)),
  };
  jest.spyOn(customerDb, 'unreadCount').mockResolvedValue(ok(0));
  refresh = jest
    .spyOn(supabase.auth, 'refreshSession')
    .mockResolvedValue({ data: { session: {} }, error: null } as never);
  jest.mocked(useMyBookings).mockReturnValue({
    bookings: splitBookings([fromEvent(ev(), TODAY)]),
    rows: null,
    saved: null,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
});

afterEach(() => {
  qc.clear();
  jest.useRealTimers();
});

it('shows unread rows bold with a dot, read ones without, and relative times', async () => {
  show([booked, paid, plain]);
  await open();
  const row = await screen.findByRole('button', {
    name: 'Unread, Booking confirmed, Your ticket for Afrobeats night is ready., 5 min ago',
  });
  expect(row).toBeTruthy();
  expect(screen.getByTestId('unread-booked')).toBeTruthy();
  expect(screen.getAllByLabelText('Unread')).toHaveLength(2);
  expect(screen.queryByTestId('unread-paid')).toBeNull();
  expect(screen.getByRole('button', { name: 'Payment received, Message, Yesterday' })).toBeTruthy();
  expect(screen.getByText('Sat 10 Oct')).toBeTruthy();
  const bold = fontFamily(typeVariants.bodyStrong.font, typeVariants.bodyStrong.weight);
  expect(screen.getByText('Booking confirmed')).toHaveStyle({ fontFamily: bold });
  expect(screen.getByText('Payment received')).not.toHaveStyle({ fontFamily: bold });
});

it('a tap marks it read and opens the booking it is about', async () => {
  // The refetch after the write sees it read.
  db.notifications
    .mockResolvedValueOnce(ok([booked]))
    .mockResolvedValue(ok([{ ...booked, read: true }]));
  const h = await open();
  await fireEvent.press(await screen.findByRole('button', { name: /^Unread, Booking confirmed/ }));
  expect(db.markRead).toHaveBeenCalledWith('u1', ['booked']);
  expect(h.onOpenBooking).toHaveBeenCalledWith('event', 'e1');
  // TanStack batches its notifications on a 0 ms timer.
  await waitFor(() => {
    expect(screen.queryByTestId('unread-booked')).toBeNull();
  });
});

it('a read one with an account link opens the tab without writing', async () => {
  show([paid]);
  const h = await open();
  await fireEvent.press(await screen.findByRole('button', { name: /^Payment received/ }));
  expect(db.markRead).not.toHaveBeenCalled();
  expect(h.onOpenTab).toHaveBeenCalledWith('account');
});

it('one with no target is only marked read', async () => {
  show([plain]);
  const h = await open();
  await fireEvent.press(await screen.findByRole('button', { name: /^Unread, Welcome/ }));
  expect(db.markRead).toHaveBeenCalledWith('u1', ['plain']);
  expect(h.onOpenBooking).not.toHaveBeenCalled();
  expect(h.onOpenTab).not.toHaveBeenCalled();
});

it('mark all as read offers Undo for 5 s, and Undo marks the same ones unread', async () => {
  // The refetch after the write sees them all read.
  db.notifications
    .mockResolvedValueOnce(ok([booked, paid, plain]))
    .mockResolvedValue(ok([booked, paid, plain].map((n) => ({ ...n, read: true }))));
  await open();
  await screen.findByText('Booking confirmed');
  await fireEvent.press(screen.getByRole('link', { name: 'Mark all as read' }));
  expect(db.markAllRead).toHaveBeenCalledWith('u1');
  expect(screen.getByText('All marked as read')).toBeTruthy();
  // Pinned below the list, not in its header (it doesn't scroll away).
  expect(within(screen.getByTestId('undo-bar')).getByText('All marked as read')).toBeTruthy();
  expect(
    within(screen.getByTestId('notifications-list')).queryByText('All marked as read'),
  ).toBeNull();
  await waitFor(() => {
    expect(screen.queryAllByLabelText('Unread')).toHaveLength(0);
  });
  expect(screen.getByRole('link', { name: 'Mark all as read' })).toBeDisabled();

  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => {
    expect(db.markUnread).toHaveBeenCalledWith('u1', ['booked', 'plain']);
  });
  expect(screen.queryByText('All marked as read')).toBeNull();
});

it('the Undo banner goes after 5 s', async () => {
  show([booked]);
  await open();
  await screen.findByText('Booking confirmed');
  await fireEvent.press(screen.getByRole('link', { name: 'Mark all as read' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(UNDO_MS - 100);
  });
  expect(screen.getByText('All marked as read')).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
  });
  expect(screen.queryByText('All marked as read')).toBeNull();
});

it('a stale session: zero rows → refresh → retry → rolled back with a neutral banner', async () => {
  show([booked]);
  db.markRead.mockResolvedValue(ok(0));
  await open();
  await fireEvent.press(await screen.findByRole('button', { name: /^Unread, Booking confirmed/ }));
  expect(
    await screen.findByText('Couldn’t update. Sign in again if this keeps happening.'),
  ).toBeTruthy();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(db.markRead).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('unread-booked')).toBeTruthy();
});

it('a transient failure says try again', async () => {
  show([booked]);
  db.markAllRead.mockResolvedValue(err({ kind: 'network' }));
  await open();
  await screen.findByText('Booking confirmed');
  await fireEvent.press(screen.getByRole('link', { name: 'Mark all as read' }));
  expect(await screen.findByText('Couldn’t update — try again')).toBeTruthy();
  expect(screen.queryByText('All marked as read')).toBeNull();
  expect(screen.getByTestId('unread-booked')).toBeTruthy();
});

it('long press opens a sheet to mark unread or delete', async () => {
  show([booked, paid]);
  await open();
  await fireEvent(await screen.findByRole('button', { name: /^Payment received/ }), 'longPress');
  await fireEvent.press(screen.getByRole('button', { name: 'Mark as unread' }));
  expect(db.markUnread).toHaveBeenCalledWith('u1', ['paid']);

  await fireEvent(screen.getByRole('button', { name: /^Unread, Booking confirmed/ }), 'longPress');
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(db.remove).toHaveBeenCalledWith('u1', 'booked');
  await waitFor(() => {
    expect(screen.queryByText('Booking confirmed')).toBeNull();
  });
});

it('each row has a visible More button (44 pt) that opens the same sheet', async () => {
  show([booked, paid]);
  await open();
  const more = await screen.findByRole('button', { name: 'More actions for Payment received' });
  expect(within(more).getByTestId('icon-button-face')).toHaveStyle({ width: 44, height: 44 });
  await fireEvent.press(more);
  await fireEvent.press(screen.getByRole('button', { name: 'Mark as unread' }));
  expect(db.markUnread).toHaveBeenCalledWith('u1', ['paid']);
});

it('says so when there are none, with Mark all disabled', async () => {
  await open();
  expect(await screen.findByText('No notifications yet')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Mark all as read' })).toBeDisabled();
});

it('a booking notification goes to the Bookings tab while bookings are not loaded', async () => {
  jest.mocked(useMyBookings).mockReturnValue({
    bookings: null,
    rows: null,
    saved: null,
    loading: true,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
  // Its link would say Account: the booking id wins, even unmatched.
  show([{ ...booked, link: '/dashboard/customer/profile' }]);
  const h = await open();
  await fireEvent.press(await screen.findByRole('button', { name: /^Unread, Booking confirmed/ }));
  expect(db.markRead).toHaveBeenCalledWith('u1', ['booked']);
  expect(h.onOpenTab).toHaveBeenCalledWith('bookings');
  expect(h.onOpenBooking).not.toHaveBeenCalled();
});

it('a write error can be dismissed, and a clean pull to refresh clears it', async () => {
  show([booked]);
  db.markRead.mockResolvedValue(err({ kind: 'network' }));
  await open();
  await fireEvent.press(await screen.findByRole('button', { name: /^Unread, Booking confirmed/ }));
  await screen.findByText('Couldn’t update — try again');
  await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByText('Couldn’t update — try again')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: /^Unread, Booking confirmed/ }));
  await screen.findByText('Couldn’t update — try again');
  const before = db.notifications.mock.calls.length;
  await pullToRefresh();
  expect(db.notifications.mock.calls.length).toBe(before + 1);
  await waitFor(() => {
    expect(screen.queryByText('Couldn’t update — try again')).toBeNull();
  });
});

it('a failed pull to refresh keeps the write error', async () => {
  show([booked]);
  db.markRead.mockResolvedValue(err({ kind: 'network' }));
  await open();
  await fireEvent.press(await screen.findByRole('button', { name: /^Unread, Booking confirmed/ }));
  await screen.findByText('Couldn’t update — try again');
  db.notifications.mockResolvedValue(err({ kind: 'network' }));
  await pullToRefresh();
  await waitFor(() => {
    expect(db.notifications.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByText('Couldn’t update — try again')).toBeTruthy();
});

it('any other row action ends the Undo', async () => {
  show([booked, paid]);
  await open();
  await screen.findByText('Booking confirmed');
  await fireEvent.press(screen.getByRole('link', { name: 'Mark all as read' }));
  expect(screen.getByText('All marked as read')).toBeTruthy();
  await fireEvent(screen.getByRole('button', { name: /^Payment received/ }), 'longPress');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.queryByText('All marked as read')).toBeNull();
  expect(db.markUnread).not.toHaveBeenCalled();
});
