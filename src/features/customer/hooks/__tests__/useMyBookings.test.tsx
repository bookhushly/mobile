import { act, renderHook, waitFor } from '@testing-library/react-native';

import { customerDb } from '@/features/customer/api/customerDb';
import { useBooking } from '@/features/customer/hooks/useBooking';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import { wallet, type Wallet, type WalletEntry } from '@/features/customer/offline/wallet';
import { ok } from '@/shared/lib/result';

import { ap, ev, ho, makeQueryClient, NOON, TODAY, USER, wrapper } from './customerTestUtils';

let mockNow = 0;
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/features/customer/offline/wallet', () => ({
  wallet: { save: jest.fn(), load: jest.fn() },
}));
jest.mock('@/features/customer/api/customerDb', () => ({
  customerDb: {
    events: jest.fn(),
    hotels: jest.fn(),
    apartments: jest.fn(),
    event: jest.fn(),
    hotel: jest.fn(),
    apartment: jest.fn(),
  },
}));

// Spies, not jest.mocked(obj.method): referencing a method unbound trips the lint rule.
type Db = typeof customerDb;
let db: {
  events: jest.SpiedFunction<Db['events']>;
  hotels: jest.SpiedFunction<Db['hotels']>;
  apartments: jest.SpiedFunction<Db['apartments']>;
  event: jest.SpiedFunction<Db['event']>;
  hotel: jest.SpiedFunction<Db['hotel']>;
};
let save: jest.SpiedFunction<typeof wallet.save>;
let load: jest.SpiedFunction<typeof wallet.load>;
const NETWORK = { ok: false as const, error: { kind: 'network' as const } };

function entry(p: Partial<WalletEntry>): WalletEntry {
  return {
    kind: 'hotel',
    id: 'h1',
    title: 'Harbour Suites',
    place: 'Ikeja, Lagos',
    start: '2026-10-14',
    end: '2026-10-16',
    time: '14:00',
    status: 'Confirmed',
    tone: 'success',
    paid: true,
    pending: false,
    when: 'upcoming',
    next: 'Check-in 14 Oct from 2:00 pm',
    imageUrl: null,
    createdAt: '2026-10-01T10:00:00+00:00',
    ...p,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNow = NOON;
  save = jest.spyOn(wallet, 'save').mockResolvedValue(undefined);
  load = jest.spyOn(wallet, 'load').mockResolvedValue(null);
  db = {
    events: jest.spyOn(customerDb, 'events').mockResolvedValue(ok([ev()])),
    hotels: jest.spyOn(customerDb, 'hotels').mockResolvedValue(ok([ho()])),
    apartments: jest.spyOn(customerDb, 'apartments').mockResolvedValue(ok([ap()])),
    event: jest.spyOn(customerDb, 'event'),
    hotel: jest.spyOn(customerDb, 'hotel'),
  };
});

async function run() {
  const qc = makeQueryClient();
  const hook = await renderHook(() => useMyBookings(USER), { wrapper: wrapper(qc) });
  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });
  return {
    result: hook.result,
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

it('loads the three lists, splits them for Lagos today and saves the wallet', async () => {
  const { result, done } = await run();
  expect(db.events).toHaveBeenCalledWith(USER);
  expect(result.current.error).toBe(false);
  expect(result.current.saved).toBeNull();
  expect(result.current.rows?.events).toHaveLength(1);
  expect(result.current.bookings?.today.map((b) => b.id)).toEqual(['h1']);
  expect(result.current.bookings?.upcoming.map((b) => b.id)).toEqual(['e1']);
  expect(result.current.bookings?.past.map((b) => b.id)).toEqual(['a1']);

  expect(save).toHaveBeenCalledTimes(1);
  const [user, entries, now] = save.mock.calls[0] ?? [];
  expect(user).toBe(USER);
  expect(now).toBe(NOON);
  const event = entries?.find((e) => e.id === 'e1');
  expect(event?.tickets?.map((t) => t.id)).toEqual(['t1']);
  expect(event?.liveOnly).toBe(true);
  expect(entries?.find((e) => e.id === 'h1')?.checkInCode).toBe('AB12CD34');
  await done();
});

it('keeps tickets and check-in codes out of the wallet unless they may be shown', async () => {
  db.events.mockResolvedValue(ok([ev({ payment_status: 'pending', status: 'pending' })]));
  db.hotels.mockResolvedValue(ok([ho({ payment_status: 'pending' })]));
  const { done } = await run();
  const entries = save.mock.calls[0]?.[1] ?? [];
  const event = entries.find((e) => e.id === 'e1');
  expect(event).toBeDefined();
  expect(event).not.toHaveProperty('tickets');
  expect(entries.find((e) => e.id === 'h1')).not.toHaveProperty('checkInCode');
  await done();
});

it('re-dates the lists when a later fetch settles on a new Lagos day', async () => {
  const qc = makeQueryClient();
  const hook = await renderHook(() => useMyBookings(USER), { wrapper: wrapper(qc) });
  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });
  expect(hook.result.current.bookings?.today.map((b) => b.id)).toEqual(['h1']);
  // Two days on, the stay (check-out 15 Oct) has gone.
  mockNow = NOON + 3 * 86_400_000;
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => {
    expect(hook.result.current.bookings?.today).toEqual([]);
  });
  expect(hook.result.current.bookings?.past.map((b) => b.id)).toContain('h1');
  await hook.unmount();
  qc.clear();
});

it('ignores a wallet that fails to save', async () => {
  save.mockRejectedValue(new Error('disk full'));
  const { result, done } = await run();
  expect(result.current.error).toBe(false);
  expect(result.current.bookings?.today).toHaveLength(1);
  await done();
});

it('shows the saved wallet, re-dated for today, when the load fails', async () => {
  db.hotels.mockResolvedValue(NETWORK);
  const saved: Wallet = {
    userId: USER,
    savedAt: NOON - 86_400_000,
    entries: [
      // Saved yesterday as upcoming; it starts today.
      entry({ id: 'h1', start: TODAY, end: '2026-10-15' }),
      entry({ id: 'h2', start: '2026-10-18', end: '2026-10-19' }),
      // Ended yesterday: never shown from the wallet.
      entry({ id: 'h3', start: '2026-10-10', end: '2026-10-12', when: 'today' }),
    ],
  };
  load.mockResolvedValue(saved);
  const { result, done } = await run();
  // Any failed table fails the load: no partial list from the other two.
  expect(result.current.rows).toBeNull();
  expect(save).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledWith(USER);
  expect(result.current.error).toBe(false);
  expect(result.current.saved).toEqual({ savedAt: saved.savedAt });
  expect(result.current.bookings?.today.map((b) => b.id)).toEqual(['h1']);
  expect(result.current.bookings?.today[0]?.when).toBe('today');
  expect(result.current.bookings?.upcoming.map((b) => b.id)).toEqual(['h2']);
  expect(result.current.bookings?.past).toEqual([]);
  await done();
});

it('is an error when the load fails and there is no wallet', async () => {
  db.events.mockResolvedValue(NETWORK);
  const { result, done } = await run();
  expect(result.current.error).toBe(true);
  expect(result.current.bookings).toBeNull();
  expect(result.current.saved).toBeNull();
  await done();
});

it('treats an unreadable wallet as no wallet', async () => {
  db.events.mockResolvedValue(NETWORK);
  load.mockRejectedValue(new Error('keychain'));
  const { result, done } = await run();
  expect(result.current.error).toBe(true);
  await done();
});

describe('useBooking', () => {
  async function runOne(kind: 'event' | 'hotel', id: string) {
    const qc = makeQueryClient();
    const hook = await renderHook(() => useBooking(USER, kind, id), { wrapper: wrapper(qc) });
    return {
      result: hook.result,
      done: async () => {
        await hook.unmount();
        qc.clear();
      },
    };
  }

  it('reads one booking by kind', async () => {
    db.hotel.mockResolvedValue(ok(ho()));
    const { result, done } = await runOne('hotel', 'h1');
    await waitFor(() => {
      expect(result.current.row).toBeDefined();
    });
    expect(db.hotel).toHaveBeenCalledWith(USER, 'h1');
    expect(result.current.row?.id).toBe('h1');
    expect(result.current.fromWallet).toBeNull();
    expect(result.current.error).toBe(false);
    await done();
  });

  it('falls back to the wallet entry when the read fails', async () => {
    db.event.mockResolvedValue(NETWORK);
    const saved = entry({ kind: 'event', id: 'e1', liveOnly: false });
    load.mockResolvedValue({ userId: USER, savedAt: NOON, entries: [entry({}), saved] });
    const { result, done } = await runOne('event', 'e1');
    await waitFor(() => {
      expect(result.current.fromWallet).not.toBeNull();
    });
    expect(result.current.fromWallet?.kind).toBe('event');
    expect(result.current.row).toBeUndefined();
    expect(result.current.error).toBe(false);
    await done();
  });

  it('is an error when the read fails and the wallet lacks it', async () => {
    db.event.mockResolvedValue(NETWORK);
    load.mockResolvedValue({ userId: USER, savedAt: NOON, entries: [entry({})] });
    const { result, done } = await runOne('event', 'e1');
    await waitFor(() => {
      expect(result.current.error).toBe(true);
    });
    expect(result.current.fromWallet).toBeNull();
    await done();
  });
});
