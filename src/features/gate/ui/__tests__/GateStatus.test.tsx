import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { EMPTY_SYNC } from '@/features/gate/domain/syncLine';
import { useSyncView } from '@/features/gate/state/syncView';
import { GateStatus } from '@/features/gate/ui/GateStatus';

const NOW = Date.parse('2026-10-08T18:00:00Z');

beforeEach(() => {
  useSyncView.getState().reset();
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
  const first = screen.getByTestId('gate-status-live');
  await act(() => {
    useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 180_000 } });
  });
  expect(screen.getByTestId('gate-status-live')).toBe(first);
  await act(() => {
    useSyncView.getState().set({ mode: 'offline' });
  });
  expect(screen.getByTestId('gate-status-live')).not.toBe(first);
});
