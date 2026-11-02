import { act, render, screen } from '@testing-library/react-native';
import { usePathname } from 'expo-router';
import { AppState } from 'react-native';

import { AUTH_PHOTOS, AuthBackdrop } from '@/features/auth/components/AuthBackdrop';
import { CYCLE_MS } from '@/features/auth/domain/authBackdrop';
import { useMotionTier } from '@/shared/ui/motion';

// The native image view drops `source` under Jest; a plain view keeps it readable.
jest.mock('expo-image', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Image = (props: object) => createElement(View, props);
  Image.loadAsync = jest.fn(() => Promise.resolve());
  return { Image };
});
jest.mock('expo-router', () => ({ usePathname: jest.fn() }));
jest.mock('@/shared/ui/motion', () => ({ useMotionTier: jest.fn() }));

const pathMock = jest.mocked(usePathname);
const tierMock = jest.mocked(useMotionTier);

function shownPhoto(): unknown {
  return screen.getByTestId('auth-photo', { includeHiddenElements: true }).props.source;
}

async function advance(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

let emitAppState: ((s: string) => void) | undefined;

beforeEach(() => {
  jest.useFakeTimers();
  pathMock.mockReturnValue('/welcome');
  tierMock.mockReturnValue('full');
  emitAppState = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
    emitAppState = fn as (s: string) => void;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('cycles on /welcome', async () => {
  await render(<AuthBackdrop />);
  expect(shownPhoto()).toBe(AUTH_PHOTOS[0]);
  await advance(CYCLE_MS);
  expect(shownPhoto()).toBe(AUTH_PHOTOS[1]);
});

it('holds the photo off /welcome', async () => {
  const view = await render(<AuthBackdrop />);
  await advance(CYCLE_MS);
  pathMock.mockReturnValue('/sign-in');
  await view.rerender(<AuthBackdrop />);
  await advance(CYCLE_MS * 3);
  expect(shownPhoto()).toBe(AUTH_PHOTOS[1]);
});

it('starts on the hotel photo on any route', async () => {
  pathMock.mockReturnValue('/new-password');
  await render(<AuthBackdrop />);
  expect(shownPhoto()).toBe(AUTH_PHOTOS[0]);
});

it('does not cycle when tier is none', async () => {
  tierMock.mockReturnValue('none');
  await render(<AuthBackdrop />);
  await advance(CYCLE_MS * 3);
  expect(shownPhoto()).toBe(AUTH_PHOTOS[0]);
});

it('pauses in the background', async () => {
  await render(<AuthBackdrop />);
  await act(() => {
    emitAppState?.('background');
  });
  await advance(CYCLE_MS * 3);
  expect(shownPhoto()).toBe(AUTH_PHOTOS[0]);
  await act(() => {
    emitAppState?.('active');
  });
  await advance(CYCLE_MS);
  expect(shownPhoto()).toBe(AUTH_PHOTOS[1]);
});
