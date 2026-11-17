import { act, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { AccessibilityInfo, AppState } from 'react-native';

import { AUTH_PHOTOS, AuthBackdrop, TOP_FADE_HOLD } from '@/features/auth/components/AuthBackdrop';
import { SLIDE_MS as CYCLE_MS } from '@/features/auth/domain/welcomeSlides';
import { useWelcomeSlide } from '@/features/auth/hooks/useWelcomeSlide';
import { useMotionTier } from '@/shared/ui/motion';

// The native image view drops `source` under Jest; a plain view keeps it readable.
jest.mock('expo-image', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Image = Object.assign((props: object) => createElement(View, props), {
    loadAsync: jest.fn(() => Promise.resolve()),
  });
  return { Image };
});
jest.mock('expo-linear-gradient', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { LinearGradient: (props: object) => createElement(View, props) };
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
  useWelcomeSlide.setState({ index: 0, chosen: false });
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
  expect(shownPhoto()).toBe(AUTH_PHOTOS.hotel);
  await advance(CYCLE_MS);
  expect(shownPhoto()).toBe(AUTH_PHOTOS.event);
});

it('holds the photo off /welcome', async () => {
  const view = await render(<AuthBackdrop />);
  await advance(CYCLE_MS);
  pathMock.mockReturnValue('/sign-in');
  await view.rerender(<AuthBackdrop />);
  await advance(CYCLE_MS * 3);
  expect(shownPhoto()).toBe(AUTH_PHOTOS.event);
});

it('stops for good once the person picks a slide', async () => {
  await render(<AuthBackdrop />);
  await act(() => {
    useWelcomeSlide.getState().show(2);
  });
  expect(shownPhoto()).toBe(AUTH_PHOTOS.apartment);
  await advance(CYCLE_MS * 3);
  expect(shownPhoto()).toBe(AUTH_PHOTOS.apartment);
});

it('starts on the hotel photo on any route', async () => {
  pathMock.mockReturnValue('/new-password');
  await render(<AuthBackdrop />);
  expect(shownPhoto()).toBe(AUTH_PHOTOS.hotel);
});

it('does not cycle when tier is none', async () => {
  tierMock.mockReturnValue('none');
  await render(<AuthBackdrop />);
  await advance(CYCLE_MS * 3);
  expect(shownPhoto()).toBe(AUTH_PHOTOS.hotel);
});

it('pauses in the background', async () => {
  await render(<AuthBackdrop />);
  await act(() => {
    emitAppState?.('background');
  });
  await advance(CYCLE_MS * 3);
  expect(shownPhoto()).toBe(AUTH_PHOTOS.hotel);
  await act(() => {
    emitAppState?.('active');
  });
  await advance(CYCLE_MS);
  expect(shownPhoto()).toBe(AUTH_PHOTOS.event);
});

const photoProps = () => screen.getByTestId('auth-photo', { includeHiddenElements: true }).props;

it('keeps decoded photos in memory and does not pre-decode them', async () => {
  await render(<AuthBackdrop />);
  expect(photoProps().cachePolicy).toBe('memory');
  // eslint-disable-next-line @typescript-eslint/unbound-method -- a jest.fn, never called here
  expect(Image.loadAsync).not.toHaveBeenCalled();
});

it('skips the crossfade when tier is none', async () => {
  tierMock.mockReturnValue('none');
  await render(<AuthBackdrop />);
  expect(photoProps().transition).toBe(0);
});

it('darkens the top so the status bar and logo read on pale photos', async () => {
  await render(<AuthBackdrop />);
  const fade = screen.getByTestId('auth-top-fade', { includeHiddenElements: true });
  // Holds full strength past the status bar and logo, so contrast doesn't depend on the photo.
  expect(fade.props.locations).toEqual([0, TOP_FADE_HOLD, 1]);
});

it('holds still while a screen reader is on', async () => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  await render(<AuthBackdrop />);
  await advance(CYCLE_MS * 3);
  expect(shownPhoto()).toBe(AUTH_PHOTOS.hotel);
});
