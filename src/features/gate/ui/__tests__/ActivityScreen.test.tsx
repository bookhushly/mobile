import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { ActivityRow } from '@/features/gate/domain/activityCsv';
import { EMPTY_SYNC } from '@/features/gate/domain/syncLine';
import type { ActivityTab, AttentionItem } from '@/features/gate/offline/outboxStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { ActivityScreen } from '@/features/gate/ui/ActivityScreen';
import { color } from '@/shared/theme';

const NOW = Date.parse('2026-10-07T18:00:30Z');

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

// Every test unmounts inside its own body (cleanup wraps the unmount in act). Jest yields to the
// event loop between a test body and afterEach, and an overdue VirtualizedList batch timer firing
// in that gap (a slow, cold first test) logs "not wrapped in act"; an afterEach comes too late.
function screenIt(name: string, fn: () => Promise<void>) {
  it(name, async () => {
    await fn();
    await cleanup();
  });
}

afterEach(() => {
  useSyncView.getState().reset();
});

function setup(
  over: {
    initialTab?: ActivityTab;
    load?: Load;
    share?: jest.Mock;
    onRefreshList?: jest.Mock;
    now?: () => number;
  } = {},
) {
  const load = jest.fn<ReturnType<Load>, Parameters<Load>>(
    over.load ?? (() => Promise.resolve([])),
  );
  const exportRows = jest.fn(() => Promise.resolve([ROW]));
  const share = over.share ?? jest.fn(() => Promise.resolve());
  const onSyncNow = jest.fn();
  const onRefreshList = over.onRefreshList ?? jest.fn();
  const onClose = jest.fn();
  return {
    load,
    exportRows,
    share,
    onSyncNow,
    onRefreshList,
    onClose,
    ui: (
      <ActivityScreen
        visible
        initialTab={over.initialTab ?? 'toSync'}
        load={load}
        exportRows={exportRows}
        share={share}
        onSyncNow={onSyncNow}
        onRefreshList={onRefreshList}
        now={over.now ?? (() => NOW)}
        onClose={onClose}
      />
    ),
  };
}

const renderActivity = async (over: Parameters<typeof setup>[0] = {}) => {
  const s = setup(over);
  await render(s.ui);
  return s;
};

screenIt('opens on the initial tab', async () => {
  const s = setup({ initialTab: 'attention' });
  await render(s.ui);
  expect(screen.getByText('Activity')).toBeTruthy();
  await waitFor(() => {
    expect(s.load).toHaveBeenCalledWith('attention', null);
  });
  expect(
    screen.getByRole('tab', { name: /^Needs attention/ }).props.accessibilityState,
  ).toMatchObject({
    selected: true,
  });
});

screenIt('switching tab loads that tab', async () => {
  const s = setup();
  await render(s.ui);
  await fireEvent.press(screen.getByRole('tab', { name: /^Synced/ }));
  await waitFor(() => {
    expect(s.load).toHaveBeenLastCalledWith('synced', null);
  });
});

screenIt('"Load more" passes the last seq when a page is full', async () => {
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

screenIt('no "Load more" when a page is short', async () => {
  const s = setup({ load: () => Promise.resolve([item(1)]) });
  await render(s.ui);
  expect(await screen.findByText('VIP · ticket 1')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
});

screenIt('marks lookup and override rows and shows the state pill and note', async () => {
  const s = setup({
    load: () =>
      Promise.resolve([
        item(3, { mode: 'manual_lookup' }),
        item(2, { mode: 'offline_override', ticketType: null, ticketIndex: null }),
        item(1, { state: 'duplicate', result: { scanned_by: 'Ada' } }),
      ]),
  });
  await render(s.ui);
  expect(await screen.findByText(/Lookup/)).toBeTruthy();
  expect(screen.getByText(/Override/)).toBeTruthy();
  expect(screen.getByText('Ticket')).toBeTruthy();
  expect(screen.getAllByText('To sync')).toHaveLength(2);
  expect(screen.getByText('Duplicate')).toBeTruthy();
  expect(screen.getByText('Also admitted by Ada')).toBeTruthy();
});

screenIt('Export shares the CSV under the activity file name', async () => {
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

screenIt('a share failure shows the error copy', async () => {
  const s = setup({ share: jest.fn(() => Promise.reject(new Error('sharing unavailable'))) });
  await render(s.ui);
  await fireEvent.press(screen.getByRole('button', { name: 'Export CSV' }));
  expect(await screen.findByText('Couldn’t export — try again')).toBeTruthy();
});

screenIt('"Sync now" and "Close" call through', async () => {
  useSyncView.getState().set({ pending: 2 });
  const s = setup();
  await render(s.ui);
  await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  expect(s.onSyncNow).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(s.onClose).toHaveBeenCalled();
});

screenIt('is read-only: nothing to undo or delete', async () => {
  const s = setup({ load: () => Promise.resolve([item(1, { mode: 'offline_override' })]) });
  await render(s.ui);
  await screen.findByText(/Override/);
  expect(screen.queryByRole('button', { name: /undo|delete|remove/i })).toBeNull();
  expect(screen.queryByLabelText(/undo|delete|remove/i)).toBeNull();
});

screenIt('a failed load says so', async () => {
  const s = setup({ load: () => Promise.reject(new Error('db')) });
  await render(s.ui);
  expect(await screen.findByText('Couldn’t load the list — try again.')).toBeTruthy();
});

screenIt('"Sync now" is only offered while something waits to sync', async () => {
  const s = setup();
  await render(s.ui);
  expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
});

screenIt('shows the offline list card and refreshes it', async () => {
  useSyncView.getState().set({ list: { count: 1240, syncedAt: NOW - 120_000 } });
  const onRefreshList = jest.fn();
  await renderActivity({ onRefreshList, now: () => NOW });
  expect(screen.getByText('1,240 tickets · updated 2 min ago')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh list' }));
  expect(onRefreshList).toHaveBeenCalledTimes(1);
});

screenIt('says when the offline list is not downloaded yet', async () => {
  await renderActivity();
  expect(screen.getByText('Not downloaded yet')).toBeTruthy();
});

screenIt('lookup and override markers are not violet', async () => {
  await renderActivity({ load: jest.fn().mockResolvedValue([item(1, { mode: 'manual_lookup' })]) });
  const marker = await screen.findByText(/Lookup/);
  expect(marker).not.toHaveStyle({ color: color.linkText });
});

screenIt('groups rows under their local hour', async () => {
  await renderActivity({
    load: () =>
      Promise.resolve([
        item(3, { scannedAt: '2026-10-07T18:40:00Z' }),
        item(2, { scannedAt: '2026-10-07T18:05:00Z' }),
        item(1, { scannedAt: '2026-10-07T17:50:00Z' }),
      ]),
  });
  await screen.findByText('VIP · ticket 3');
  const hh = (iso: string) => `${String(new Date(Date.parse(iso)).getHours()).padStart(2, '0')}:00`;
  const headers = screen.getAllByRole('header').map((n) => String(n.props.children));
  expect(headers.filter((h) => /^\d\d:00$/.test(h))).toEqual([
    hh('2026-10-07T18:40:00Z'),
    hh('2026-10-07T17:50:00Z'),
  ]);
});

// Deferred promises so tests decide which request settles first.
function deferred<T>() {
  let resolve: (v: T) => void = () => undefined;
  let reject: (e: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const seqs = (from: number, n: number) => Array.from({ length: n }, (_, i) => item(from - i));
const bumpPending = async (n: number) => {
  await act(() => {
    useSyncView.setState({ status: { ...EMPTY_SYNC, pending: n } });
  });
};
const shownTickets = () =>
  screen.queryAllByText(/^VIP · ticket \d+$/).map((n) => String(n.props.children));

describe('during a sync', () => {
  afterEach(async () => {
    await act(() => {
      useSyncView.getState().reset();
    });
  });

  screenIt(
    'a load-more that settles after a count-change reload is dropped (no duplicates)',
    async () => {
      const calls: { before: number | null; d: ReturnType<typeof deferred<AttentionItem[]>> }[] =
        [];
      const s = setup({
        load: (_tab, before) => {
          const d = deferred<AttentionItem[]>();
          calls.push({ before, d });
          return d.promise;
        },
      });
      await render(s.ui);
      await act(async () => {
        calls[0]?.d.resolve(seqs(200, 50));
        await Promise.resolve();
      });
      await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
      expect(calls[1]?.before).toBe(151);
      await bumpPending(3);
      expect(calls[2]?.before).toBeNull();
      // The reload settles first (a short page, so the list renders it all), then the stale
      // load-more, which belongs to the old page and must not be appended.
      await act(async () => {
        calls[2]?.d.resolve(seqs(199, 5));
        await Promise.resolve();
      });
      await act(async () => {
        calls[1]?.d.resolve(seqs(150, 50));
        await Promise.resolve();
      });
      expect(shownTickets()).toEqual(
        [199, 198, 197, 196, 195].map((n) => `VIP · ticket ${String(n)}`),
      );
    },
  );

  screenIt('"Load more" is hidden while a reload is pending', async () => {
    const calls: ReturnType<typeof deferred<AttentionItem[]>>[] = [];
    const s = setup({
      load: () => {
        const d = deferred<AttentionItem[]>();
        calls.push(d);
        return d.promise;
      },
    });
    await render(s.ui);
    await act(async () => {
      calls[0]?.resolve(seqs(200, 50));
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: 'Load more' })).toBeTruthy();
    await bumpPending(1);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    await act(async () => {
      calls[1]?.resolve(seqs(200, 50));
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: 'Load more' })).toBeTruthy();
  });

  screenIt('a failed reload keeps the rows and shows the error above them', async () => {
    let n = 0;
    const s = setup({
      load: () => {
        n += 1;
        return n === 1 ? Promise.resolve([item(1)]) : Promise.reject(new Error('db'));
      },
    });
    await render(s.ui);
    expect(await screen.findByText('VIP · ticket 1')).toBeTruthy();
    await bumpPending(2);
    expect(await screen.findByText('Couldn’t load the list — try again.')).toBeTruthy();
    expect(screen.getByText('VIP · ticket 1')).toBeTruthy();
  });
});

screenIt('closing during an export never opens the share sheet', async () => {
  const rows = deferred<ActivityRow[]>();
  const share = jest.fn(() => Promise.resolve());
  const props = {
    initialTab: 'toSync' as const,
    load: () => Promise.resolve([]),
    exportRows: () => rows.promise,
    share,
    onSyncNow: jest.fn(),
    onRefreshList: jest.fn(),
    now: () => NOW,
    onClose: jest.fn(),
  };
  await render(<ActivityScreen visible {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Export CSV' }));
  await screen.rerender(<ActivityScreen visible={false} {...props} />);
  await act(async () => {
    rows.resolve([ROW]);
    await Promise.resolve();
  });
  expect(share).not.toHaveBeenCalled();
});

screenIt('each row reads as one element with ticket, time, marker and state', async () => {
  const s = setup({
    load: () =>
      Promise.resolve([item(4, { mode: 'manual_lookup', scannedAt: '2026-10-07T18:05:00Z' })]),
  });
  await render(s.ui);
  await screen.findByText(/Lookup/);
  const d = new Date(Date.parse('2026-10-07T18:05:00Z'));
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  expect(screen.getByLabelText(`VIP · ticket 4, ${hhmm}, Lookup, Waiting to sync`)).toBeTruthy();
});
