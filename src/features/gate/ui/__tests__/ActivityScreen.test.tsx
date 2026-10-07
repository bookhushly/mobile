import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ActivityRow } from '@/features/gate/domain/activityCsv';
import type { ActivityTab, AttentionItem } from '@/features/gate/offline/outboxStore';
import { ActivityScreen } from '@/features/gate/ui/ActivityScreen';

const item = (seq: number, over: Partial<AttentionItem> = {}): AttentionItem => ({
  seq,
  reason: null,
  approvedBy: null,
  eventId: 'e',
  ticketId: `t${String(seq)}`,
  code: `t${String(seq)}`,
  scannedAt: '2026-10-07T18:00:00Z',
  mode: 'offline',
  kid: null,
  appVersion: '1',
  state: 'pending',
  attempts: 0,
  nextTryAt: 0,
  result: null,
  ticketType: 'VIP',
  ticketIndex: seq,
  ...over,
});

const ROW: ActivityRow = {
  ticketId: '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  ticketType: 'VIP',
  ticketIndex: 2,
  scannedAt: '2026-10-07T18:00:00Z',
  mode: 'manual_lookup',
  state: 'synced',
  result: null,
  reason: null,
  approvedBy: 'Ada',
};

type Load = (tab: ActivityTab, beforeSeq: number | null) => Promise<AttentionItem[]>;

function setup(over: { initialTab?: ActivityTab; load?: Load; share?: jest.Mock } = {}) {
  const load = jest.fn<ReturnType<Load>, Parameters<Load>>(
    over.load ?? (() => Promise.resolve([])),
  );
  const exportRows = jest.fn(() => Promise.resolve([ROW]));
  const share = over.share ?? jest.fn(() => Promise.resolve());
  const onSyncNow = jest.fn();
  const onClose = jest.fn();
  return {
    load,
    exportRows,
    share,
    onSyncNow,
    onClose,
    ui: (
      <ActivityScreen
        visible
        initialTab={over.initialTab ?? 'toSync'}
        load={load}
        exportRows={exportRows}
        share={share}
        onSyncNow={onSyncNow}
        onClose={onClose}
      />
    ),
  };
}

it('opens on the initial tab', async () => {
  const s = setup({ initialTab: 'attention' });
  await render(s.ui);
  expect(screen.getByText('Activity')).toBeTruthy();
  await waitFor(() => {
    expect(s.load).toHaveBeenCalledWith('attention', null);
  });
  expect(
    screen.getByRole('tab', { name: 'Needs attention' }).props.accessibilityState,
  ).toMatchObject({
    selected: true,
  });
});

it('switching tab loads that tab', async () => {
  const s = setup();
  await render(s.ui);
  await fireEvent.press(screen.getByRole('tab', { name: 'Synced' }));
  await waitFor(() => {
    expect(s.load).toHaveBeenLastCalledWith('synced', null);
  });
});

it('"Load more" passes the last seq when a page is full', async () => {
  const page = Array.from({ length: 50 }, (_, i) => item(200 - i));
  const s = setup({
    load: (_tab, before) => Promise.resolve(before === null ? page : [item(10)]),
  });
  await render(s.ui);
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  await waitFor(() => {
    expect(s.load).toHaveBeenLastCalledWith('toSync', 151);
  });
});

it('no "Load more" when a page is short', async () => {
  const s = setup({ load: () => Promise.resolve([item(1)]) });
  await render(s.ui);
  expect(await screen.findByText('VIP · ticket 1')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
});

it('marks lookup and override rows and shows the state line', async () => {
  const s = setup({
    load: () =>
      Promise.resolve([
        item(3, { mode: 'manual_lookup' }),
        item(2, { mode: 'offline_override', ticketType: null, ticketIndex: null }),
        item(1, { state: 'duplicate', result: { scanned_by: 'Ada' } }),
      ]),
  });
  await render(s.ui);
  expect(await screen.findByText('Lookup')).toBeTruthy();
  expect(screen.getByText('Override')).toBeTruthy();
  expect(screen.getByText('Ticket')).toBeTruthy();
  expect(screen.getAllByText('Waiting to sync')).toHaveLength(2);
  expect(screen.getByText('Also admitted by Ada')).toBeTruthy();
});

it('Export shares the CSV under the activity file name', async () => {
  const s = setup();
  await render(s.ui);
  await fireEvent.press(screen.getByRole('button', { name: 'Export CSV' }));
  await waitFor(() => {
    expect(s.share).toHaveBeenCalledTimes(1);
  });
  const [name, text] = s.share.mock.calls[0] as [string, string];
  expect(name).toBe('bookhushly-scan-activity.csv');
  expect(
    text.startsWith(
      'ticket_ref,ticket_type,ticket_number,scanned_at,mode,state,server_note,reason,approved_by',
    ),
  ).toBe(true);
  expect(text).toContain('3f2b8c4e');
});

it('a share failure shows the error copy', async () => {
  const s = setup({ share: jest.fn(() => Promise.reject(new Error('sharing unavailable'))) });
  await render(s.ui);
  await fireEvent.press(screen.getByRole('button', { name: 'Export CSV' }));
  expect(await screen.findByText('Couldn’t export — try again')).toBeTruthy();
});

it('"Sync now" and "Close" call through', async () => {
  const s = setup();
  await render(s.ui);
  await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  expect(s.onSyncNow).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(s.onClose).toHaveBeenCalled();
});

it('is read-only: nothing to undo or delete', async () => {
  const s = setup({ load: () => Promise.resolve([item(1, { mode: 'offline_override' })]) });
  await render(s.ui);
  await screen.findByText('Override');
  expect(screen.queryByRole('button', { name: /undo|delete|remove/i })).toBeNull();
  expect(screen.queryByLabelText(/undo|delete|remove/i)).toBeNull();
});

it('a failed load says so', async () => {
  const s = setup({ load: () => Promise.reject(new Error('db')) });
  await render(s.ui);
  expect(await screen.findByText('Couldn’t load the list — try again.')).toBeTruthy();
});
