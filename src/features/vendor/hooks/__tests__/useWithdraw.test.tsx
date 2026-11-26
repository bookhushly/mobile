import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { vendorSource } from '@/features/vendor/api/vendorSource';
import { useWithdraw, withdrawErrorWords } from '@/features/vendor/hooks/useEarnings';

let mockN = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `key-${String(++mockN)}` }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => 0 } }));
jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));
jest.mock('@/shared/platform/storage', () => {
  const m = new Map<string, string>();
  return {
    plainKv: {
      get: (k: string) => Promise.resolve(m.get(k) ?? null),
      set: (k: string, v: string) => {
        m.set(k, v);
        return Promise.resolve();
      },
      delete: (k: string) => {
        m.delete(k);
        return Promise.resolve();
      },
    },
  };
});

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useWithdraw', () => {
  it('a retry of the same amount reuses the key (no second payout); the next withdrawal gets a new one', async () => {
    const ok = {
      ok: true as const,
      value: {
        id: 'w',
        kind: 'withdrawal' as const,
        title: 't',
        at: 'x',
        amount: 1,
        status: 'pending' as const,
      },
    };
    const spy = jest
      .spyOn(vendorSource, 'withdraw')
      .mockResolvedValueOnce({ ok: false, error: { kind: 'timeout' } })
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok);
    const { result } = await renderHook(() => useWithdraw({ vendorId: 'v', kind: 'logistics' }), {
      wrapper: wrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync(5_000).catch(() => undefined);
    });
    expect(withdrawErrorWords(result.current.error).transient).toBe(true);
    await act(async () => {
      await result.current.mutateAsync(5_000);
    });
    await act(async () => {
      await result.current.mutateAsync(7_000);
    });
    expect(spy.mock.calls.map((c) => c[2])).toEqual(['key-1', 'key-1', 'key-2']);
  });
});
