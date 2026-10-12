import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { useDeskLive } from '@/features/receptionist/hooks/useDeskLive';
import { supabase } from '@/shared/supabase/client';

jest.mock('@/shared/supabase/client', () => ({
  supabase: { channel: jest.fn(), removeChannel: jest.fn() },
}));

type Filter = { event: string; schema: string; table: string; filter: string };
type Listener = (payload: unknown) => void;
type FakeChannel = {
  on: jest.Mock<FakeChannel, [string, Filter, Listener]>;
  subscribe: jest.Mock<FakeChannel, [((status: string) => void)?]>;
};

// A fake channel: records the postgres_changes bindings and lets the test fire events/status.
function fakeChannel() {
  const bindings: { filter: Filter; cb: Listener }[] = [];
  let onStatus: ((status: string) => void) | undefined;
  const channel: FakeChannel = {
    on: jest.fn((_type: string, filter: Filter, cb: Listener) => {
      bindings.push({ filter, cb });
      return channel;
    }),
    subscribe: jest.fn((cb?: (status: string) => void) => {
      onStatus = cb;
      return channel;
    }),
  };
  return {
    channel,
    bindings,
    status: (s: string) => {
      onStatus?.(s);
    },
    fire: (table: string) => {
      for (const b of bindings) if (b.filter.table === table) b.cb({});
    },
  };
}

const HOTEL = 'h1';

const OPTS = { cancelRefetch: false };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  AppState.currentState = 'active';
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  AppState.currentState = 'active';
});

async function run() {
  const fake = fakeChannel();
  const channel = jest.spyOn(supabase, 'channel').mockReturnValue(fake.channel as never);
  const removeChannel = jest.spyOn(supabase, 'removeChannel').mockResolvedValue('ok');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const invalidate = jest.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(
    () => {
      useDeskLive(HOTEL);
    },
    { wrapper },
  );
  return {
    fake,
    channel,
    invalidate,
    removeChannel,
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

it('subscribes to bookings and rooms for this hotel and refetches once joined', async () => {
  const { fake, channel, invalidate, done } = await run();
  // A unique topic per run so a quick remount never attaches to a leaving channel.
  expect(channel).toHaveBeenCalledWith(expect.stringMatching(/^desk:h1:\d+$/));
  expect(fake.bindings.map((b) => b.filter)).toEqual([
    { event: '*', schema: 'public', table: 'hotel_bookings', filter: 'hotel_id=eq.h1' },
    { event: '*', schema: 'public', table: 'hotel_rooms', filter: 'hotel_id=eq.h1' },
  ]);
  expect(fake.channel.subscribe.mock.calls).toHaveLength(1);
  expect(invalidate).not.toHaveBeenCalled();

  await act(() => {
    fake.status('SUBSCRIBED');
  });
  expect(invalidate).toHaveBeenCalledTimes(1);
  // An in-flight refetch is kept, not cancelled and restarted.
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', 'h1'] }, OPTS);
  await done();
});

it('a burst inside 5 s is at most two invalidations: leading and trailing', async () => {
  const { fake, invalidate, done } = await run();
  await act(() => {
    for (let i = 0; i < 10; i++) {
      fake.fire('hotel_bookings');
      fake.fire('hotel_rooms');
      jest.advanceTimersByTime(400);
    }
  });
  expect(invalidate).toHaveBeenCalledTimes(1);
  await act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(invalidate).toHaveBeenCalledTimes(2);
  expect(invalidate.mock.calls.every((c) => c[1]?.cancelRefetch === false)).toBe(true);
  await done();
});

it('never invalidates while the app is in the background', async () => {
  const { fake, invalidate, done } = await run();
  AppState.currentState = 'background';
  await act(() => {
    fake.status('SUBSCRIBED');
    fake.fire('hotel_bookings');
    jest.advanceTimersByTime(6_000);
    fake.fire('hotel_rooms');
    jest.advanceTimersByTime(6_000);
  });
  expect(invalidate).not.toHaveBeenCalled();
  await done();
});

it('ignores other statuses and removes the channel on unmount', async () => {
  const { fake, invalidate, removeChannel, done } = await run();
  await act(() => {
    fake.status('CHANNEL_ERROR');
    fake.status('TIMED_OUT');
    fake.status('CLOSED');
    jest.advanceTimersByTime(3_000);
  });
  expect(invalidate).not.toHaveBeenCalled();

  await act(() => {
    fake.fire('hotel_rooms');
    fake.fire('hotel_rooms');
  });
  expect(invalidate).toHaveBeenCalledTimes(1);
  await done();
  expect(removeChannel).toHaveBeenCalledWith(fake.channel);
  await act(() => {
    jest.advanceTimersByTime(3_000);
  });
  // The pending trailing bump is cancelled with the channel.
  expect(invalidate).toHaveBeenCalledTimes(1);
});
