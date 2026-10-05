import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { fetchSummary } from '@/features/gate/api/scan';
import { useScanSummary } from '@/features/gate/hooks/useScanSummary';

jest.mock('@/shared/api/instance', () => ({ api: {} }));
jest.mock('@/features/gate/api/scan', () => ({ fetchSummary: jest.fn() }));
const mockFetch = jest.mocked(fetchSummary);

const EVENT = '11111111-1111-4111-8111-111111111111';

async function run(error: { kind: 'unavailable'; status: number } | { kind: 'forbidden' }) {
  mockFetch.mockResolvedValue({ ok: false, error });
  // gcTime Infinity: no 5-minute GC timer after unmount to keep the Jest worker alive.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useScanSummary(EVENT, false), { wrapper });
  await waitFor(() => {
    expect(hook.result.current.stale).toBe(true);
  });
  return {
    result: hook.result,
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

it('is stale when the summary fails before it ever loaded', async () => {
  const { result, done } = await run({ kind: 'unavailable', status: 503 });
  expect(result.current.summary).toBeNull();
  expect(result.current.forbidden).toBe(false);
  await done();
});

it('reports forbidden when the summary route answers 403', async () => {
  const { result, done } = await run({ kind: 'forbidden' });
  expect(result.current.forbidden).toBe(true);
  expect(result.current.stale).toBe(true);
  await done();
});
