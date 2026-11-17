import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import CustomerTabsLayout from '@/app/(customer)/(tabs)/_layout';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';

const mockTabs = { mounts: 0, unmounts: 0 };
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const Tabs = ({ children }: { children: ReactNode }) => {
    useEffect(() => {
      mockTabs.mounts += 1;
      return () => {
        mockTabs.unmounts += 1;
      };
    }, []);
    return children;
  };
  Tabs.Screen = function TabsScreen() {
    return null;
  };
  return { Tabs };
});
jest.mock('@/shared/platform/storage', () => {
  const { memoryKv: make } =
    jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv');
  return { plainKv: make() };
});
jest.mock('@/shared/supabase/client', () => ({ supabase: { auth: {} } }));

const mockMarkSeen = jest.fn();
const mockTour: { seen: boolean | null; askedFor: (string | null)[] } = {
  seen: null,
  askedFor: [],
};
jest.mock('@/features/customer/hooks/useTourSeen', () => ({
  useTourSeen: (userId: string | null) => {
    mockTour.askedFor.push(userId);
    return { seen: userId === null ? null : mockTour.seen, markSeen: mockMarkSeen };
  },
}));

const signedIn = { status: 'signedIn', userId: 'u1', email: 'a@b.co' } as const;
const change = (run: () => void) =>
  act(async () => {
    run();
    await Promise.resolve();
  });
const signIn = () =>
  change(() => {
    useAuth.setState({ state: signedIn });
  });
const modeSettles = () =>
  change(() => {
    useBrowseChoice.setState({ browsing: false });
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockTabs.mounts = 0;
  mockTabs.unmounts = 0;
  mockTour.seen = null;
  mockTour.askedFor = [];
  useBrowseChoice.setState({ browsing: true });
  useAuth.setState({ state: { status: 'signedOut' }, recovery: false });
});

const sameTabs = () => {
  expect(mockTabs.mounts).toBe(1);
  expect(mockTabs.unmounts).toBe(0);
};

it('signing in from a tab keeps the same tabs while the marker is read', async () => {
  await render(<CustomerTabsLayout />);
  sameTabs();
  await signIn();
  await modeSettles();
  sameTabs();
  expect(screen.queryByTestId('tour-gate-pending')).toBeNull();
});

it('a first-time account sees the tour over the same tabs, and finishing leaves them', async () => {
  mockTour.seen = false;
  await render(<CustomerTabsLayout />);
  await signIn();
  await modeSettles();
  sameTabs();
  expect(screen.getByText('Find your place')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(mockMarkSeen).toHaveBeenCalledTimes(1);
  mockTour.seen = true;
  // A new state object: the layout renders again and reads the marker as seen.
  await change(() => {
    useAuth.setState({ state: { ...signedIn } });
  });
  expect(screen.queryByText('Find your place')).toBeNull();
  sameTabs();
});

it('no tour during the mode lookup: the account may yet be staff', async () => {
  mockTour.seen = false;
  await render(<CustomerTabsLayout />);
  await signIn();
  expect(mockTour.askedFor).not.toContain('u1');
  expect(screen.queryByText('Find your place')).toBeNull();
  sameTabs();
});

it('signed in at first mount still waits for the marker before any tabs', async () => {
  useBrowseChoice.setState({ browsing: false });
  useAuth.setState({ state: signedIn });
  await render(<CustomerTabsLayout />);
  expect(screen.getByTestId('tour-gate-pending')).toBeTruthy();
  expect(mockTabs.mounts).toBe(0);
});
