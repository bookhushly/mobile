import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

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

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
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
    jest.advanceTimersByTime(600);
  });
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', 'h1'] });
  await done();
});

it('coalesces a burst of events into one invalidation and bounds steady traffic', async () => {
  const { fake, invalidate, done } = await run();
  await act(() => {
    fake.fire('hotel_bookings');
    fake.fire('hotel_rooms');
    jest.advanceTimersByTime(600);
  });
  expect(invalidate).toHaveBeenCalledTimes(1);

  // An event every 300 ms for 2 s: at most one invalidation per 2 s, never starved.
  await act(() => {
    for (let i = 0; i < 7; i++) {
      fake.fire('hotel_bookings');
      jest.advanceTimersByTime(300);
    }
  });
  expect(invalidate).toHaveBeenCalledTimes(2);
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
  });
  await done();
  expect(removeChannel).toHaveBeenCalledWith(fake.channel);
  await act(() => {
    jest.advanceTimersByTime(3_000);
  });
  // A pending bump is cancelled with the channel.
  expect(invalidate).not.toHaveBeenCalled();
});
