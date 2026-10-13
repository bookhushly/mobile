import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import CustomerTabsLayout from '@/app/(customer)/(tabs)/_layout';
import CustomerLayout, { unstable_settings } from '@/app/(customer)/_layout';
import CheckInCodeRoute from '@/app/(customer)/check-in-code/[bookingId]';
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
const mockTour = jest.fn((_userId: string | null) => ({ seen: null, markSeen: jest.fn() }));
jest.mock('@/features/customer/hooks/useTourSeen', () => ({
  useTourSeen: (userId: string | null) => mockTour(userId),
}));

const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';

beforeEach(() => {
  mockNav.tabs = null;
  mockNav.tabNames = [];
  mockNav.stack = {};
  mockNav.params = {};
  mockTour.mockClear();
});

it('customer mode lands on the bookings tab', () => {
  expect(ROUTE_HREF.customer).toBe('/bookings');
  expect(unstable_settings).toEqual({ initialRouteName: '(tabs)' });
});

it('has Bookings and Account tabs with the desk tabs styling and no tour read', async () => {
  await render(<CustomerTabsLayout />);
  expect(mockNav.tabNames).toEqual(['bookings', 'account']);
  expect(mockNav.tabs).toMatchObject({
    tabBarPosition: 'bottom',
    tabBarActiveTintColor: color.linkText,
    tabBarActiveBackgroundColor: color.selectedWash,
  });
  // C15: the tour is off, so its marker is never read.
  expect(mockTour).toHaveBeenCalledWith(null);
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

it.each<[string, Record<string, unknown>]>([
  ['an unknown kind', { kind: 'flight', id: ID }],
  ['a non-UUID id', { kind: 'event', id: 'e1' }],
  ['no params', {}],
])('a booking link with %s is not on your account', async (_, params) => {
  mockNav.params = params;
  await render(<MyBookingRoute />);
  expect(screen.getByText("This booking isn't on your account")).toBeTruthy();
});

it.each([TicketsRoute, CheckInCodeRoute])(
  'a code route with a bad id is not on your account',
  async (Route) => {
    mockNav.params = { bookingId: 'nope' };
    await render(<Route />);
    expect(screen.getByText("This booking isn't on your account")).toBeTruthy();
    mockNav.params = { bookingId: ID };
    await render(<Route />);
    expect(screen.queryByText("This booking isn't on your account")).toBeNull();
  },
);
