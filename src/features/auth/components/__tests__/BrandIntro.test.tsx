import { act, render, screen } from '@testing-library/react-native';

import {
  BrandIntro,
  HOLD_MS,
  INTRO_TOTAL_MS,
  WAIT_CAP_MS,
} from '@/features/auth/components/BrandIntro';
import {
  noteLaunchRoute,
  noteWelcomeDrawn,
  resetLaunchIntroForTests,
} from '@/features/auth/launchIntro';
import { motion } from '@/shared/theme';
import { useMotionTier } from '@/shared/ui/motion';

jest.mock('@/shared/ui/motion', () => ({ useMotionTier: jest.fn() }));
const tierMock = jest.mocked(useMotionTier);

beforeEach(() => {
  jest.useFakeTimers();
  resetLaunchIntroForTests();
  tierMock.mockReturnValue('full');
});

const introOf = () => screen.queryByTestId('brand-intro', { includeHiddenElements: true });

afterEach(() => {
  jest.useRealTimers();
});

it('opens a launch that lands on Welcome, then gets out of the way', async () => {
  noteLaunchRoute('auth');
  noteWelcomeDrawn();
  await render(<BrandIntro />);
  expect(screen.getByTestId('brand-intro', { includeHiddenElements: true })).toBeTruthy();
  await act(() => {
    jest.advanceTimersByTime(INTRO_TOTAL_MS.full);
  });
  expect(screen.queryByTestId('brand-intro', { includeHiddenElements: true })).toBeNull();
});

it('shows once per launch', async () => {
  noteLaunchRoute('auth');
  const first = await render(<BrandIntro />);
  await first.unmount();
  await render(<BrandIntro />);
  expect(screen.queryByTestId('brand-intro', { includeHiddenElements: true })).toBeNull();
});

it('stays away when the launch went somewhere else', async () => {
  noteLaunchRoute('customer');
  await render(<BrandIntro />);
  expect(screen.queryByTestId('brand-intro', { includeHiddenElements: true })).toBeNull();
});

it('under Reduce Motion, holds the brand and leaves without moving', async () => {
  tierMock.mockReturnValue('none');
  noteLaunchRoute('auth');
  noteWelcomeDrawn();
  await render(<BrandIntro />);
  await act(() => {
    jest.advanceTimersByTime(HOLD_MS);
  });
  expect(screen.queryByTestId('brand-intro', { includeHiddenElements: true })).toBeNull();
});

it('on a reduced tier, leaves with a short fade', async () => {
  tierMock.mockReturnValue('reduced');
  noteLaunchRoute('auth');
  noteWelcomeDrawn();
  await render(<BrandIntro />);
  await act(() => {
    jest.advanceTimersByTime(HOLD_MS + motion.duration.base);
  });
  expect(screen.queryByTestId('brand-intro', { includeHiddenElements: true })).toBeNull();
});

it('reveals the name beside the mark before leaving (owner’s pick D)', async () => {
  noteLaunchRoute('auth');
  noteWelcomeDrawn();
  await render(<BrandIntro />);
  // The name is drawn from the start, hidden in its window until the mark steps aside.
  expect(screen.getByTestId('brand-intro-name', { includeHiddenElements: true })).toBeTruthy();
  await act(() => {
    jest.advanceTimersByTime(INTRO_TOTAL_MS.full - 1);
  });
  expect(screen.getByTestId('brand-intro', { includeHiddenElements: true })).toBeTruthy();
});

// Recorded 2026-11-15: started at once, the timeline ran while Welcome was still being built, and
// the violet dissolved onto nothing before Welcome popped in.
it('holds the mark until Welcome has drawn beneath, then plays', async () => {
  noteLaunchRoute('auth');
  await render(<BrandIntro />);
  await act(() => {
    jest.advanceTimersByTime(INTRO_TOTAL_MS.full + 100);
  });
  expect(introOf()).toBeTruthy();
  await act(() => {
    noteWelcomeDrawn();
  });
  await act(() => {
    jest.advanceTimersByTime(INTRO_TOTAL_MS.full);
  });
  expect(introOf()).toBeNull();
});

it('never hangs: starts after the cap if Welcome never draws', async () => {
  noteLaunchRoute('auth');
  await render(<BrandIntro />);
  await act(() => {
    jest.advanceTimersByTime(WAIT_CAP_MS);
  });
  await act(() => {
    jest.advanceTimersByTime(INTRO_TOTAL_MS.full);
  });
  expect(introOf()).toBeNull();
});

// Code review 2026-11-17: Welcome's buttons sit under the violet; a tap must never reach them.
it('blocks taps while it covers Welcome, and lets them through once the violet goes', async () => {
  noteLaunchRoute('auth');
  noteWelcomeDrawn();
  await render(<BrandIntro />);
  expect(introOf()?.props.pointerEvents).toBe('auto');
  await act(() => {
    jest.advanceTimersByTime(INTRO_TOTAL_MS.full - 100);
  });
  expect(introOf()?.props.pointerEvents).toBe('none');
});
