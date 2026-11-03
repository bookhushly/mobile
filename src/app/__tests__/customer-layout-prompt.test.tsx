import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import CustomerLayout from '@/app/(customer)/_layout';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { savedDb, type SavedInput } from '@/features/customer/api/savedDb';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';
import { err, ok } from '@/shared/lib/result';
import { elevation, layout } from '@/shared/theme';

jest.mock('expo-router', () => {
  const Stack = ({ children }: { children?: ReactNode }) => children ?? null;
  Stack.Screen = function StackScreen() {
    return null;
  };
  return { Stack, router: { push: jest.fn() }, useIsFocused: () => true };
});
jest.mock('@/shared/platform/storage', () => {
  const { memoryKv: make } =
    jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv');
  return { plainKv: make() };
});
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => 0 } }));
jest.mock('@/shared/supabase/client', () => ({ supabase: { auth: {} } }));
jest.mock('@/features/customer/hooks/useResumePayments', () => ({
  useResumePayments: () => undefined,
}));
jest.mock('@/features/customer/api/savedDb', () => ({
  savedDb: { list: jest.fn(), save: jest.fn(), unsave: jest.fn(), isSaved: jest.fn() },
}));
const mockSignOut = jest.fn();
jest.mock('@/features/auth/hooks/useSignOut', () => ({ useSignOut: () => mockSignOut }));
const mockSheet: { last: { onDismissed?: () => void } | null } = { last: null };
jest.mock('@/shared/ui/Sheet', () => {
  const actual = jest.requireActual<typeof import('@/shared/ui/Sheet')>('@/shared/ui/Sheet');
  return {
    Sheet: (props: ComponentProps<typeof actual.Sheet>) => {
      mockSheet.last = props;
      return <actual.Sheet {...props} />;
    },
  };
});

const HOTEL: SavedInput = {
  listingId: 'h1',
  kind: 'hotel',
  title: 'Harbour Suites',
  image: null,
  location: 'Ikeja, Lagos',
};
const signedIn = { status: 'signedIn', userId: 'u1', email: 'a@b.co' } as const;
const save = jest.spyOn(savedDb, 'save');

let qc: QueryClient;
const mount = () =>
  render(
    <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}>
      <QueryClientProvider client={qc}>
        <CustomerLayout />
      </QueryClientProvider>
    </SafeAreaInsetsContext.Provider>,
  );
const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.spyOn(savedDb, 'list').mockResolvedValue(ok([]));
  save.mockResolvedValue(ok(undefined));
  useSignInPrompt.setState({ reason: null, pendingSave: null });
  useBrowseChoice.setState({ browsing: true });
  useAuth.setState({ state: { status: 'signedOut' }, recovery: false });
});
afterEach(() => {
  qc.clear();
});

it.each([
  ['Create account', '/sign-up'],
  ['Sign in', '/sign-in'],
])('%s opens %s once the sheet has gone', async (label, href) => {
  useSignInPrompt.getState().ask('book');
  await mount();
  await fireEvent.press(screen.getByText(label));
  expect(router.push).not.toHaveBeenCalled();
  await act(async () => {
    mockSheet.last?.onDismissed?.();
    await Promise.resolve();
  });
  expect(router.push).toHaveBeenCalledWith(href);
});

// Customer is held through the mode lookup, so this account may yet turn out to be staff.
it('holds the pending save until the mode lookup has settled', async () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().proceed();
  await mount();
  await act(async () => {
    useAuth.setState({ state: signedIn });
    await Promise.resolve();
  });
  await settle();
  expect(save).not.toHaveBeenCalled();
  expect(useSignInPrompt.getState().pendingSave).toEqual(HOTEL);

  await act(async () => {
    useBrowseChoice.setState({ browsing: false });
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(save).toHaveBeenCalledTimes(1);
  });
  expect(save).toHaveBeenCalledWith('u1', HOTEL);
  expect(useSignInPrompt.getState().pendingSave).toBeNull();
});

it('does not save on a reset session, which never counted as signed in', async () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().proceed();
  useBrowseChoice.setState({ browsing: false });
  useAuth.setState({ state: signedIn, recovery: true });
  await mount();
  await settle();
  expect(save).not.toHaveBeenCalled();
  expect(useSignInPrompt.getState().pendingSave).toEqual(HOTEL);
});

describe('the pending save fails after sign-in', () => {
  const failWith = async (error: Parameters<typeof err>[0]) => {
    save.mockResolvedValue(err(error) as Awaited<ReturnType<typeof savedDb.save>>);
    useSignInPrompt.getState().ask('save', HOTEL);
    useSignInPrompt.getState().proceed();
    useBrowseChoice.setState({ browsing: false });
    useAuth.setState({ state: signedIn });
    await mount();
  };

  it('a connection failure says so, is not retried, and can be dismissed', async () => {
    await failWith({ kind: 'network' });
    expect(await screen.findByTestId('saved-transient')).toBeTruthy();
    expect(screen.getByText('Couldn’t save — check your connection and try again.')).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(screen.queryByTestId('saved-transient')).toBeNull();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('floats on the phone gutter at elevation 3', async () => {
    await failWith({ kind: 'network' });
    await screen.findByTestId('saved-transient');
    const banner = screen.getByTestId('pending-save-notice');
    expect(banner).toHaveStyle({ left: layout.phoneGutter, right: layout.phoneGutter });
    expect(banner).toHaveStyle(elevation.e3);
  });

  it('a stale session offers signing in again', async () => {
    await failWith({ kind: 'staleSession' });
    expect(await screen.findByTestId('saved-stale')).toBeTruthy();
    await fireEvent.press(screen.getByText('Sign in again'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('a successful save shows nothing', async () => {
    useSignInPrompt.getState().ask('save', HOTEL);
    useSignInPrompt.getState().proceed();
    useBrowseChoice.setState({ browsing: false });
    useAuth.setState({ state: signedIn });
    await mount();
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    await settle();
    expect(screen.queryByTestId('saved-transient')).toBeNull();
    expect(screen.queryByTestId('saved-stale')).toBeNull();
  });
});
