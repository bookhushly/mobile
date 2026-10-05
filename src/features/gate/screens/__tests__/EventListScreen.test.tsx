import { fireEvent, render, screen } from '@testing-library/react-native';

import { EventListScreen } from '@/features/gate/screens/EventListScreen';
import type { ScannableEvent } from '@/shared/api/scannableEvents';

const NOW = Date.parse('2026-10-05T12:00:00.000Z');
const ev = (id: string, title: string | null, startsAt: string | null): ScannableEvent => ({
  id,
  title,
  startsAt,
  location: 'Lagos',
});
const base = {
  nowMs: NOW,
  lastEventId: null,
  identity: 'gate@example.com',
  refreshing: false,
  onRefresh: jest.fn(),
  onRetry: jest.fn(),
  onOpen: jest.fn(),
  onSignOut: jest.fn(),
};

it('empty: tells staff to ask the organiser and offers sign out', async () => {
  const onSignOut = jest.fn();
  await render(
    <EventListScreen {...base} onSignOut={onSignOut} state={{ status: 'ready', events: [] }} />,
  );
  expect(screen.getByText('No events assigned — ask the organiser.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalled();
});

it('auto-opens the last event once when it is still listed', async () => {
  const onOpen = jest.fn();
  const events = [ev('a', 'Afro Night', '2026-10-06T18:00:00Z')];
  const { rerender } = await render(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      lastEventId="a"
      state={{ status: 'ready', events }}
    />,
  );
  expect(onOpen).toHaveBeenCalledWith('a');
  await rerender(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      lastEventId="a"
      state={{ status: 'ready', events }}
    />,
  );
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('does not auto-open a remembered event that is in the past', async () => {
  const onOpen = jest.fn();
  await render(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      lastEventId="old"
      state={{ status: 'ready', events: [ev('old', 'Last week', '2026-09-28T18:00:00Z')] }}
    />,
  );
  expect(onOpen).not.toHaveBeenCalled();
});

it('does not auto-open an event that is no longer listed', async () => {
  const onOpen = jest.fn();
  await render(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      lastEventId="gone"
      state={{ status: 'ready', events: [ev('a', 'Afro Night', null)] }}
    />,
  );
  expect(onOpen).not.toHaveBeenCalled();
});

it('lists upcoming events, hides past ones under Earlier, and labels hidden listings', async () => {
  const onOpen = jest.fn();
  await render(
    <EventListScreen
      {...base}
      onOpen={onOpen}
      state={{
        status: 'ready',
        events: [
          ev('11111111-2222-4333-8444-555555555555', null, null),
          ev('old', 'Last month', '2026-09-01T18:00:00Z'),
        ],
      }}
    />,
  );
  expect(screen.getByText('Event · 11111111')).toBeTruthy();
  expect(screen.queryByText('Last month')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Earlier (1)' }));
  await fireEvent.press(screen.getByRole('button', { name: /Last month/ }));
  expect(onOpen).toHaveBeenCalledWith('old');
});

it('error state offers retry and never says there are no events', async () => {
  const onRetry = jest.fn();
  await render(<EventListScreen {...base} onRetry={onRetry} state={{ status: 'error' }} />);
  expect(screen.queryByText(/No events assigned/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalled();
});
