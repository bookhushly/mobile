import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WifiOff } from 'lucide-react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { color } from '@/shared/theme';
import { Banner } from '@/shared/ui/Banner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Illustration } from '@/shared/ui/Illustration';
import { Skeleton, SkeletonRows } from '@/shared/ui/Skeleton';
import { StatusPill } from '@/shared/ui/StatusPill';
import { SuccessMark } from '@/shared/ui/SuccessMark';

// Lucide marks its Svg aria-hidden, so it is found by its class token, not a testID.
const lucide = (name: string) =>
  screen.container.queryAll(
    (i) =>
      typeof i.props.className === 'string' &&
      i.props.className.split(' ').includes(`lucide-${name}`),
  );

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('status pill uses its tone, never violet', async () => {
  await render(<StatusPill tone="success" label="In · 22 min ago" />);
  expect(screen.getByTestId('status-pill')).toHaveStyle({
    backgroundColor: color.status.success.bg,
  });
  expect(screen.getByText('In · 22 min ago')).toHaveStyle({ color: color.status.success.fg });
});

it('a pressable pill is a button', async () => {
  const onPress = jest.fn();
  await render(<StatusPill tone="warning" label="1 needs attention" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: '1 needs attention' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('a pill on a coloured fill is an outline in the given colour', async () => {
  await render(<StatusPill tone="success" label="Admitted" onFill={color.onInverse} />);
  expect(screen.getByTestId('status-pill')).toHaveStyle({
    backgroundColor: 'transparent',
    borderColor: color.onInverse,
  });
  expect(screen.getByText('Admitted')).toHaveStyle({ color: color.onInverse });
});

it('a status pill can wrap to two lines and cap its text scale', async () => {
  await render(
    <StatusPill
      tone="success"
      label="Online · list 2 min ago · 3 to sync"
      numberOfLines={2}
      maxScale={1}
    />,
  );
  const text = screen.getByText('Online · list 2 min ago · 3 to sync');
  expect(text.props.numberOfLines).toBe(2);
  expect(text.props.maxFontSizeMultiplier).toBe(1);
  expect(text).toHaveStyle({ flexShrink: 1 });
});

it('a status pill is one line by default', async () => {
  await render(<StatusPill tone="neutral" label="Not in" />);
  expect(screen.getByText('Not in').props.numberOfLines).toBe(1);
});

it('neutral banner uses an info glyph unless the caller passes one', async () => {
  await render(<Banner tone="neutral" message="Couldn’t load" />);
  expect(lucide('info')).toHaveLength(1);
  expect(lucide('wifi-off')).toHaveLength(0);
  await screen.rerender(<Banner tone="neutral" message="Offline" icon={WifiOff} />);
  expect(lucide('wifi-off')).toHaveLength(1);
});

it('neutral banner for a transient failure is not red', async () => {
  await render(<Banner tone="neutral" message="We couldn't reach the server" />);
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.neutral.bg });
  expect(screen.getByText("We couldn't reach the server").props.accessibilityLiveRegion).toBe(
    'polite',
  );
});

it('banner announces on iOS the message it mounts with and every change, polite or not', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  // The preset's AccessibilityInfo is already a jest.fn: clear calls left by earlier tests.
  const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
  await render(<Banner tone="neutral" message="Offline" />);
  expect(spy.mock.calls.map((c) => c[0])).toEqual(['Offline']);
  await screen.rerender(<Banner tone="neutral" message="Back online" />);
  expect(spy.mock.calls.map((c) => c[0])).toEqual(['Offline', 'Back online']);
  await screen.rerender(<Banner tone="neutral" message="Back online" />);
  expect(spy).toHaveBeenCalledTimes(2);
  await screen.rerender(<Banner tone="warning" message="Sync failed" live="assertive" />);
  expect(spy).toHaveBeenLastCalledWith('Sync failed');
});

it('on Android a banner relies on its live region and never calls announceForAccessibility', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
  await render(<Banner tone="warning" message="Roster is stale" live="assertive" />);
  await screen.rerender(<Banner tone="warning" message="Roster is fresh" live="assertive" />);
  expect(spy).not.toHaveBeenCalled();
  expect(screen.getByText('Roster is fresh').props.accessibilityLiveRegion).toBe('assertive');
});

it('banner shows a title and one action', async () => {
  const onPress = jest.fn();
  await render(
    <Banner
      tone="warning"
      title="Roster is stale"
      message="Last synced 2 h ago"
      action={{ label: 'Sync now', onPress }}
    />,
  );
  expect(screen.getByText('Roster is stale')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('empty state shows reason and one action', async () => {
  const onPress = jest.fn();
  await render(
    <EmptyState
      icon={undefined}
      title="No events assigned"
      message="Ask the organiser."
      action={{ label: 'Refresh', onPress }}
    />,
  );
  expect(screen.getByText('No events assigned')).toBeTruthy();
  expect(screen.getByText('Ask the organiser.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
});

it('empty state can carry an illustration', async () => {
  await render(<EmptyState illustration="noEvents" title="No events" />);
  expect(screen.queryByTestId('illustration-noEvents')).toBeNull();
  expect(screen.getByTestId('illustration-noEvents', { includeHiddenElements: true })).toBeTruthy();
});

it('error state only claims data is safe when told', async () => {
  const { rerender } = await render(
    <ErrorState title="Couldn't load events" onRetry={jest.fn()} />,
  );
  expect(screen.queryByText(/safe/i)).toBeNull();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  await rerender(
    <ErrorState
      title="Couldn't load events"
      safeLine="Offline lists on this phone still work"
      onRetry={jest.fn()}
    />,
  );
  expect(screen.getByText('Offline lists on this phone still work')).toBeTruthy();
});

it('error state retry label can be customised', async () => {
  const onRetry = jest.fn();
  await render(<ErrorState title="Couldn't sync" onRetry={onRetry} retryLabel="Sync again" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sync again' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it('skeleton appears only after 150 ms', async () => {
  await render(<Skeleton height={20} />);
  expect(screen.queryByTestId('skeleton')).toBeNull();
  await act(() => {
    jest.advanceTimersByTime(149);
  });
  expect(screen.queryByTestId('skeleton')).toBeNull();
  await act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(screen.getByTestId('skeleton')).toBeTruthy();
});

it('skeleton pulses on the full tier', async () => {
  await render(<Skeleton height={20} delayMs={0} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByTestId('skeleton').props.accessibilityHint).toBe('pulse');
});

it('skeleton is static under Reduce Motion', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render(<Skeleton height={20} delayMs={0} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByTestId('skeleton').props.accessibilityHint).toBe('static');
});

it('skeleton rows render the requested number of rows', async () => {
  await render(<SkeletonRows count={3} />);
  await act(() => {
    jest.advanceTimersByTime(150);
  });
  expect(screen.getByLabelText('Loading')).toBeTruthy();
  expect(screen.getAllByTestId('skeleton')).toHaveLength(9);
});

it('illustration and success mark are decorative', async () => {
  await render(
    <>
      <Illustration name="camera" />
      <SuccessMark animate />
    </>,
  );
  // Hidden from the accessibility tree by default (RNTL excludes hidden elements).
  expect(screen.queryByTestId('illustration-camera')).toBeNull();
  expect(screen.queryByTestId('success-mark')).toBeNull();
  const hidden = { includeHiddenElements: true };
  expect(screen.getByTestId('illustration-camera', hidden).props.accessibilityElementsHidden).toBe(
    true,
  );
  expect(screen.getByTestId('success-mark', hidden).props.accessibilityElementsHidden).toBe(true);
});
