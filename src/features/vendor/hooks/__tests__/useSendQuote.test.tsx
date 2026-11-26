import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { vendorSource } from '@/features/vendor/api/vendorSource';
import { quoteErrorWords, useSendQuote } from '@/features/vendor/hooks/useVendorRequests';

let mockN = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `key-${String(++mockN)}` }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => 0 } }));
jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useSendQuote', () => {
  it('a retry after a lost response sends the same idempotency key, so no second quote', async () => {
    const spy = jest
      .spyOn(vendorSource, 'sendQuote')
      .mockResolvedValueOnce({ ok: false, error: { kind: 'network' } })
      .mockResolvedValueOnce({
        ok: true,
        value: { id: 'o1', amount: 85_000, status: 'pending', sentAt: 'x' },
      });
    const { result } = await renderHook(
      () => useSendQuote({ vendorId: 'v', kind: 'logistics' }, 'r1'),
      {
        wrapper: wrapper(),
      },
    );
    const input = { amount: 85_000, message: '', vehicleId: null };
    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });
    expect(quoteErrorWords(result.current.error).transient).toBe(true);
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    const keys = spy.mock.calls.map((c) => c[2].idempotencyKey);
    expect(keys).toEqual(['key-1', 'key-1']);
  });
});

describe('quoteErrorWords', () => {
  it('a conflict is a refusal with its reason; anything unknown is a try-again', () => {
    expect(quoteErrorWords(new Error('x'))).toMatchObject({ transient: true });
  });
});
