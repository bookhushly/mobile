import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { EMPTY_SYNC } from '@/features/gate/domain/syncLine';
import { useSyncView } from '@/features/gate/state/syncView';
import { GateStatus } from '@/features/gate/ui/GateStatus';

const NOW = Date.parse('2026-10-08T18:00:00Z');

let announce: jest.SpyInstance;
// Hidden from VoiceOver's swipe order on purpose, so the query must include hidden elements.
const live = () => screen.getByTestId('gate-status-live', { includeHiddenElements: true });

beforeEach(() => {
  // RN's Jest setup already mocks AccessibilityInfo, so calls would otherwise accumulate.
  jest.clearAllMocks();
  useSyncView.getState().reset();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {
    /* captured */
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('shows the most important state and opens Activity on its tab', async () => {
  useSyncView.getState().set({ ...EMPTY_SYNC, attention: 2 });
  const onOpen = jest.fn();
  await render(<GateStatus now={() => NOW} onOpen={onOpen} />);
  await fireEvent.press(screen.getByRole('button', { name: '2 need attention' }));
  expect(onOpen).toHaveBeenCalledWith('attention');
});

it('announces only when the state kind changes', async () => {
  useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 120_000 } });
  await render(<GateStatus now={() => NOW} onOpen={jest.fn()} />);
  const first = live();
  await act(() => {
    useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 180_000 } });
  });
  expect(live()).toBe(first);
  await act(() => {
    useSyncView.getState().set({ mode: 'offline' });
  });
  expect(live()).not.toBe(first);
});

it('lets the pill shrink and wrap so " · N to sync" stays visible', async () => {
  useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 120_000 }, pending: 3 });
  await render(<GateStatus now={() => NOW} onOpen={jest.fn()} />);
  const text = screen.getByText('Online · list 2 min ago · 3 to sync');
  expect(text.props.numberOfLines).toBe(2);
  expect(screen.getByTestId('gate-status')).toHaveStyle({ flexShrink: 1 });
});

it('the minute wording advances on the 30 s tick without a store change', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 120_000 } });
  await render(<GateStatus now={() => Date.now()} onOpen={jest.fn()} />);
  expect(screen.getByText('Online · list 2 min ago')).toBeTruthy();
  await act(() => {
    jest.advanceTimersByTime(60_000);
  });
  expect(screen.getByText('Online · list 3 min ago')).toBeTruthy();
});

it('on iOS, VoiceOver hears a state change once and never the minute ticks', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 120_000 } });
  await render(<GateStatus now={() => Date.now()} onOpen={jest.fn()} />);
  expect(announce).not.toHaveBeenCalled();
  await act(() => {
    jest.advanceTimersByTime(60_000);
  });
  expect(announce).not.toHaveBeenCalled();
  await act(() => {
    useSyncView.getState().set({ mode: 'offline' });
  });
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenCalledWith('Offline · deciding on this phone');
  // The Android live region is not a second element for VoiceOver.
  expect(live().parent?.props.accessibilityElementsHidden).toBe(true);
});

it('on Android the live region does the announcing', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 120_000 } });
  await render(<GateStatus now={() => NOW} onOpen={jest.fn()} />);
  await act(() => {
    useSyncView.getState().set({ mode: 'offline' });
  });
  expect(announce).not.toHaveBeenCalled();
  expect(live().parent?.props.accessibilityLiveRegion).toBe('polite');
});
