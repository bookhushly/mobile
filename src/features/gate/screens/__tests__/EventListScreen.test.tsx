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
const liveEvent = (id: string): ScannableEvent => ({
  id,
  title: 'Gala',
  startsAt: new Date(NOW - 3_600_000).toISOString(),
  location: 'Lagos',
});
const base = {
  nowMs: NOW,
  lastEventId: null,
  offlineLists: new Set<string>(),
  refreshing: false,
  onRefresh: jest.fn(),
  onRetry: jest.fn(),
  onOpen: jest.fn(),
  onOpenAccount: jest.fn(),
};

it('empty: tells staff to ask the organiser and offers a refresh', async () => {
  const onRefresh = jest.fn();
  await render(
    <EventListScreen {...base} onRefresh={onRefresh} state={{ status: 'ready', events: [] }} />,
  );
  expect(screen.getByText('No events assigned')).toBeTruthy();
  expect(screen.getByText('Ask the organiser to add you as gate staff.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(onRefresh).toHaveBeenCalled();
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
          ev('older', 'Two months ago', '2026-08-01T18:00:00Z'),
        ],
      }}
    />,
  );
  expect(screen.getByText('Event · 11111111')).toBeTruthy();
  expect(screen.getByText('TBC')).toBeTruthy();
  expect(screen.queryByText('Last month')).toBeNull();
  const earlier = screen.getByRole('button', { name: 'Earlier (2)' });
  expect(earlier).not.toBeExpanded();
  await fireEvent.press(earlier);
  expect(screen.getByRole('button', { name: 'Earlier (2)' })).toBeExpanded();
  await fireEvent.press(screen.getByRole('button', { name: /Last month/ }));
  expect(onOpen).toHaveBeenCalledWith('old');
});

it('marks events with an offline list and a live pill', async () => {
  await render(
    <EventListScreen
      {...base}
      offlineLists={new Set(['e1'])}
      state={{ status: 'ready', events: [liveEvent('e1')] }}
    />,
  );
  expect(screen.getByText('Offline list ready')).toBeTruthy();
  expect(screen.getByText('Live now')).toBeTruthy();
});

it('shows a date tile and an upcoming pill for a later event', async () => {
  await render(
    <EventListScreen
      {...base}
      state={{ status: 'ready', events: [ev('a', 'Afro Night', '2026-10-10T18:00:00Z')] }}
    />,
  );
  expect(screen.getByText('Oct')).toBeTruthy();
  expect(screen.getByText('10')).toBeTruthy();
  expect(screen.getByText('Upcoming')).toBeTruthy();
  expect(screen.queryByText('Offline list ready')).toBeNull();
});

it('error state offers retry and never says there are no events', async () => {
  const onRetry = jest.fn();
  await render(<EventListScreen {...base} onRetry={onRetry} state={{ status: 'error' }} />);
  expect(screen.queryByText(/No events assigned/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalled();
});

it('error says offline lists still work only when there is one', async () => {
  const { rerender } = await render(<EventListScreen {...base} state={{ status: 'error' }} />);
  expect(screen.queryByText('Offline lists on this phone still work')).toBeNull();
  await rerender(
    <EventListScreen {...base} offlineLists={new Set(['e1'])} state={{ status: 'error' }} />,
  );
  expect(screen.getByText('Offline lists on this phone still work')).toBeTruthy();
});

it('account button opens the account sheet', async () => {
  const onOpenAccount = jest.fn();
  await render(
    <EventListScreen {...base} onOpenAccount={onOpenAccount} state={{ status: 'loading' }} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  expect(onOpenAccount).toHaveBeenCalledTimes(1);
});
