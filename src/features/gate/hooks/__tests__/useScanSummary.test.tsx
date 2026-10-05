import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useScanSummary } from '@/features/gate/hooks/useScanSummary';

jest.mock('@/shared/api/instance', () => ({ api: {} }));
jest.mock('@/features/gate/api/scan', () => ({
  fetchSummary: jest.fn(() =>
    Promise.resolve({ ok: false, error: { kind: 'unavailable', status: 503 } }),
  ),
}));

it('is stale when the summary fails before it ever loaded', async () => {
  // gcTime Infinity: no 5-minute GC timer after unmount to keep the Jest worker alive.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result, unmount } = await renderHook(
    () => useScanSummary('11111111-1111-4111-8111-111111111111', false),
    { wrapper },
  );
  await waitFor(() => {
    expect(result.current.stale).toBe(true);
  });
  expect(result.current.summary).toBeNull();
  await unmount();
  qc.clear();
});
