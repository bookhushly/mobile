import { act, render, screen } from '@testing-library/react-native';

import RootLayout from '@/app/_layout';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { SavedInput } from '@/features/customer/api/savedDb';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import type { ModeState } from '@/features/mode/domain/route';
import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';
import type { memoryKv } from '@/shared/lib/kv';

jest.mock('@sentry/react-native', () => ({ wrap: (c: unknown) => c }));
jest.mock('@/shared/monitoring', () => ({ initMonitoring: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/shared/platform/storage', () => {
  const { memoryKv: make } =
    jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv');
  return { plainKv: make() };
});
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/features/auth/api/session', () => ({
  startSessionListener: () => () => undefined,
}));
jest.mock('@/shared/api/queryClient', () => ({
  ...jest.requireActual<typeof import('@/shared/api/queryClient')>('@/shared/api/queryClient'),
  setupQueryManagers: () => () => undefined,
}));
jest.mock('@/shared/providers/AppProviders', () => ({
  AppProviders: ({ children }: { children: unknown }) => children,
}));
// Every screen rendered, including commits a test's final state wouldn't show.
const mockRendered: string[] = [];
// Renders only the screens whose guard passes, in declared order.
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = ({ children }: { children: unknown }) => children;
  Stack.Protected = function Protected({ guard, children }: { guard: boolean; children: unknown }) {
    return guard ? children : null;
  };
  Stack.Screen = function Screen({ name }: { name: string }) {
    mockRendered.push(name);
    return React.createElement(Text, { testID: 'stack-screen' }, name);
  };
  return { Stack };
});
let mockMode: ModeState = { status: 'loading' };
jest.mock('@/features/mode/hooks/useModeState', () => ({
  useModeState: (userId: string | null) => ({
    state: userId === null ? { status: 'idle' } : mockMode,
    chosen: null,
    choose: () => undefined,
    retry: () => undefined,
  }),
}));

const kv = jest.requireMock<{ plainKv: ReturnType<typeof memoryKv> }>(
  '@/shared/platform/storage',
).plainKv;

const customer: ModeState = {
  status: 'ready',
  resolution: { kind: 'modes', modes: ['customer'], defaultMode: 'customer' },
};
const signedIn = { status: 'signedIn', userId: 'u1', email: 'a@b.co' } as const;

const declared = () => screen.queryAllByTestId('stack-screen').map((s) => String(s.props.children));

beforeEach(async () => {
  await kv.delete('bh.browse');
  mockMode = { status: 'loading' };
  useBrowseChoice.setState({ browsing: null });
  useAuth.setState({ state: { status: 'signedOut' }, recovery: false });
});

it('signed out and not browsing: only the auth screens', async () => {
  await render(<RootLayout />);
  expect(declared()).toEqual(['(auth)', 'delete-account']);
});

it('a stored choice opens browsing, with the auth screens declared on top', async () => {
  await kv.set('bh.browse', '1');
  await render(<RootLayout />);
  expect(declared()).toEqual(['(customer)', '(auth)', 'delete-account']);
});

it('signing in removes the auth screens but holds customer while the mode loads', async () => {
  await kv.set('bh.browse', '1');
  await render(<RootLayout />);
  await act(async () => {
    useAuth.setState({ state: signedIn });
    await Promise.resolve();
  });
  expect(declared()).toEqual(['(customer)', 'delete-account']);
  expect(useBrowseChoice.getState().browsing).toBe(true);
  expect(kv.dump()['bh.browse']).toBe('1');
});

it('forgets the choice once the signed-in mode is known', async () => {
  await kv.set('bh.browse', '1');
  mockMode = customer;
  await render(<RootLayout />);
  await act(async () => {
    useAuth.setState({ state: signedIn });
    await Promise.resolve();
  });
  expect(useBrowseChoice.getState().browsing).toBe(false);
  expect(kv.dump()['bh.browse']).toBeUndefined();
  expect(declared()).toEqual(['(customer)', 'delete-account']);
});

it('a reset started while browsing takes over, then lands in customer without a crash', async () => {
  await kv.set('bh.browse', '1');
  await render(<RootLayout />);
  await act(async () => {
    useAuth.setState({ state: signedIn, recovery: true });
    await Promise.resolve();
  });
  expect(declared()).toEqual(['(auth)', 'delete-account']);
  await act(async () => {
    useAuth.setState({ recovery: false });
    await Promise.resolve();
  });
  expect(declared()).toEqual(['(customer)', 'delete-account']);
});

it('an abandoned reset goes back to browsing with the auth screens still reachable', async () => {
  await kv.set('bh.browse', '1');
  await render(<RootLayout />);
  await act(async () => {
    useAuth.setState({ state: signedIn, recovery: true });
    await Promise.resolve();
  });
  // abandonRecovery's real order: signed out first, the flag only afterwards.
  await act(async () => {
    useAuth.setState({ state: { status: 'signedOut' } });
    await Promise.resolve();
  });
  await act(async () => {
    useAuth.setState({ recovery: false });
    await Promise.resolve();
  });
  expect(declared()).toEqual(['(customer)', '(auth)', 'delete-account']);
  expect(useBrowseChoice.getState().browsing).toBe(true);
});

describe('signing out ends browsing', () => {
  const signIn = async () => {
    await kv.set('bh.browse', '1');
    await render(<RootLayout />);
    await act(async () => {
      useAuth.setState({ state: signedIn });
      await Promise.resolve();
    });
  };
  const signOut = async () => {
    mockRendered.length = 0;
    await act(async () => {
      useAuth.setState({ state: { status: 'signedOut' } });
      await Promise.resolve();
    });
  };

  it('from the mode error screen', async () => {
    mockMode = { status: 'error' };
    await signIn();
    expect(declared()).toEqual(['mode-error', 'delete-account']);
    await signOut();
    expect(declared()).toEqual(['(auth)', 'delete-account']);
    expect(kv.dump()['bh.browse']).toBeUndefined();
  });

  it('while the mode is still loading, with no render back on customer', async () => {
    await signIn();
    expect(declared()).toEqual(['(customer)', 'delete-account']);
    await signOut();
    expect(declared()).toEqual(['(auth)', 'delete-account']);
    expect(kv.dump()['bh.browse']).toBeUndefined();
    expect(mockRendered).not.toContain('(customer)');
  });

  it('after a saved reset, once the person counts as signed in', async () => {
    await kv.set('bh.browse', '1');
    await render(<RootLayout />);
    await act(async () => {
      useAuth.setState({ state: signedIn, recovery: true });
      await Promise.resolve();
    });
    await act(async () => {
      useAuth.setState({ recovery: false });
      await Promise.resolve();
    });
    await signOut();
    expect(declared()).toEqual(['(auth)', 'delete-account']);
    expect(kv.dump()['bh.browse']).toBeUndefined();
  });
});

describe('a save waiting for sign-in', () => {
  const HOTEL: SavedInput = {
    listingId: 'h1',
    kind: 'hotel',
    title: 'Harbour Suites',
    image: null,
    location: 'Ikeja, Lagos',
  };
  const signInAs = async (mode: ModeState) => {
    await kv.set('bh.browse', '1');
    mockMode = { status: 'loading' };
    useSignInPrompt.setState({ reason: null, pendingSave: HOTEL });
    const view = await render(<RootLayout />);
    await act(async () => {
      useAuth.setState({ state: signedIn });
      await Promise.resolve();
    });
    expect(useSignInPrompt.getState().pendingSave).toEqual(HOTEL);
    mockMode = mode;
    await act(async () => {
      await view.rerender(<RootLayout />);
    });
  };

  it.each<[string, ModeState]>([
    [
      'gate',
      { status: 'ready', resolution: { kind: 'modes', modes: ['gate'], defaultMode: 'gate' } },
    ],
    [
      'receptionist',
      {
        status: 'ready',
        resolution: { kind: 'modes', modes: ['receptionist'], defaultMode: 'receptionist' },
      },
    ],
    ['web-only', { status: 'ready', resolution: { kind: 'webOnly' } }],
  ])('is dropped for a %s account', async (_name, mode) => {
    await signInAs(mode);
    expect(useSignInPrompt.getState().pendingSave).toBeNull();
  });

  it('is kept for a customer', async () => {
    await signInAs(customer);
    expect(useSignInPrompt.getState().pendingSave).toEqual(HOTEL);
  });

  it('is forgotten by signing out, so it can never land on another account', async () => {
    await signInAs({ status: 'error' });
    expect(useSignInPrompt.getState().pendingSave).toEqual(HOTEL);
    await act(async () => {
      useAuth.setState({ state: { status: 'signedOut' } });
      await Promise.resolve();
    });
    expect(useSignInPrompt.getState().pendingSave).toBeNull();
  });
});
