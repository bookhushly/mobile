import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import CustomerTabsLayout from '@/app/(customer)/(tabs)/_layout';
import CustomerLayout, { unstable_settings } from '@/app/(customer)/_layout';
import CheckInCodeRoute from '@/app/(customer)/check-in-code/[bookingId]';
import ListingRoute from '@/app/(customer)/listing/[kind]/[id]';
import MyBookingRoute from '@/app/(customer)/my-booking/[kind]/[id]';
import TicketsRoute from '@/app/(customer)/tickets/[bookingId]';
import { ROUTE_HREF } from '@/features/mode/hooks/useRouteStore';
import { color } from '@/shared/theme';

type Options = Record<string, unknown>;
const mockNav: {
  tabs: Options | null;
  tabNames: string[];
  stack: Record<string, Options | undefined>;
  params: Record<string, unknown>;
} = { tabs: null, tabNames: [], stack: {}, params: {} };

jest.mock('expo-router', () => {
  const Tabs = ({ screenOptions, children }: { screenOptions: Options; children: ReactNode }) => {
    mockNav.tabs = screenOptions;
    return children;
  };
  Tabs.Screen = function TabsScreen({ name }: { name: string }) {
    mockNav.tabNames.push(name);
    return null;
  };
  const Stack = ({ children }: { children?: ReactNode }) => children ?? null;
  Stack.Screen = function StackScreen({ name, options }: { name: string; options?: Options }) {
    mockNav.stack[name] = options;
    return null;
  };
  return {
    Tabs,
    Stack,
    router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => mockNav.params,
  };
});
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: (pick: (s: { state: { status: 'signedIn'; userId: string } }) => unknown) =>
    pick({ state: { status: 'signedIn', userId: 'u1' } }),
}));
const mockTour = jest.fn(
  (_userId: string | null): { seen: boolean | null; markSeen: () => void } => ({
    seen: null,
    markSeen: jest.fn(),
  }),
);
jest.mock('@/features/customer/hooks/useTourSeen', () => ({
  useTourSeen: (userId: string | null) => mockTour(userId),
}));

// The details screen is stubbed: this test is about the booking the route hands it.
const mockScreen: { booking?: unknown } = {};
jest.mock('@/features/customer/screens/BookingScreen', () => ({
  BookingScreen: ({ booking }: { booking: unknown }) => {
    mockScreen.booking = booking;
    return null;
  },
}));

// The code screens too: the routes only parse the id and pass the raw page index on.
const mockCodes: { tickets?: unknown; checkIn?: unknown } = {};
jest.mock('@/features/customer/screens/TicketsScreen', () => ({
  TicketsScreen: (p: { userId: string; bookingId: string | null; index: unknown }) => {
    mockCodes.tickets = { userId: p.userId, bookingId: p.bookingId, index: p.index };
    return null;
  },
}));
jest.mock('@/features/customer/screens/CheckInCodeScreen', () => ({
  CheckInCodeScreen: (p: { userId: string; bookingId: string | null }) => {
    mockCodes.checkIn = { userId: p.userId, bookingId: p.bookingId };
    return null;
  },
}));

const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';

beforeEach(() => {
  mockNav.tabs = null;
  mockNav.tabNames = [];
  mockNav.stack = {};
  mockNav.params = {};
  mockTour.mockClear();
  mockScreen.booking = undefined;
  mockCodes.tickets = undefined;
  mockCodes.checkIn = undefined;
});

it('customer mode lands on the Explore tab (4b D1)', () => {
  expect(ROUTE_HREF.customer).toBe('/explore');
  expect(unstable_settings).toEqual({ initialRouteName: '(tabs)' });
});

it('has Explore, Saved, Bookings and Account tabs, in that order, with the desk tabs styling', async () => {
  await render(<CustomerTabsLayout />);
  expect(mockNav.tabNames).toEqual(['explore', 'saved', 'bookings', 'account']);
  expect(mockNav.tabs).toMatchObject({
    tabBarPosition: 'bottom',
    tabBarActiveTintColor: color.linkText,
    tabBarActiveBackgroundColor: color.selectedWash,
  });
  // B6: labels scale with Dynamic Type, capped at 1.3×.
  const renderLabel = mockNav.tabs?.tabBarLabel as (p: {
    color: string;
    children: string;
  }) => ReactElement<{ maxScale?: number }>;
  expect(renderLabel({ color: color.linkText, children: 'Bookings' }).props.maxScale).toBe(1.3);
  // D15: the tour is on, so its marker is read for the signed-in user.
  expect(mockTour).toHaveBeenCalledWith('u1');
});

it('shows the tour instead of the tabs to a user who hasn’t seen it', async () => {
  mockTour.mockReturnValueOnce({ seen: false, markSeen: jest.fn() });
  await render(<CustomerTabsLayout />);
  expect(mockNav.tabNames).toEqual([]);
  expect(screen.getByText('Find your place')).toBeTruthy();
});

it.each<[string, Record<string, unknown>, string]>([
  ['a listing kind and a UUID', { kind: 'event', id: ID }, 'Details are on their way'],
  ['an unknown kind', { kind: 'events', id: ID }, 'This listing isn’t available right now'],
  ['a non-UUID id', { kind: 'hotel', id: 'h1' }, 'This listing isn’t available right now'],
])('a listing link with %s is parsed before anything reads it', async (_, params, heading) => {
  mockNav.params = params;
  await render(<ListingRoute />);
  expect(screen.getByText(heading)).toBeTruthy();
});

it('shows tickets and the check-in code full screen and drops customer data on leaving', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  qc.setQueryData(['customer', 'u1', 'bookings'], { events: [] });
  qc.setQueryData(['desk', 'x'], 1);
  const { unmount } = await render(
    <QueryClientProvider client={qc}>
      <CustomerLayout />
    </QueryClientProvider>,
  );
  expect(mockNav.stack['tickets/[bookingId]']).toEqual({ presentation: 'fullScreenModal' });
  expect(mockNav.stack['check-in-code/[bookingId]']).toEqual({ presentation: 'fullScreenModal' });
  expect(qc.getQueryData(['customer', 'u1', 'bookings'])).toBeDefined();
  await unmount();
  expect(qc.getQueryData(['customer', 'u1', 'bookings'])).toBeUndefined();
  expect(qc.getQueryData(['desk', 'x'])).toBe(1);
  qc.clear();
});

it('hands the details screen a parsed booking', async () => {
  mockNav.params = { kind: 'hotel', id: ID };
  await render(<MyBookingRoute />);
  expect(mockScreen.booking).toEqual({ kind: 'hotel', id: ID });
});

it.each<[string, Record<string, unknown>]>([
  ['an unknown kind', { kind: 'flight', id: ID }],
  ['a non-UUID id', { kind: 'event', id: 'e1' }],
  ['no params', {}],
])('a booking link with %s is no booking (null, no query)', async (_, params) => {
  mockNav.params = params;
  await render(<MyBookingRoute />);
  expect(mockScreen.booking).toBeNull();
});

it('the code routes hand their screens a parsed id (null when not a UUID)', async () => {
  mockNav.params = { bookingId: 'nope', index: '2' };
  await render(<TicketsRoute />);
  expect(mockCodes.tickets).toEqual({ userId: 'u1', bookingId: null, index: '2' });
  await render(<CheckInCodeRoute />);
  expect(mockCodes.checkIn).toEqual({ userId: 'u1', bookingId: null });
  mockNav.params = { bookingId: ID, index: '1' };
  await render(<TicketsRoute />);
  expect(mockCodes.tickets).toEqual({ userId: 'u1', bookingId: ID, index: '1' });
  await render(<CheckInCodeRoute />);
  expect(mockCodes.checkIn).toEqual({ userId: 'u1', bookingId: ID });
});
