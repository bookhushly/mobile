import { useQuery } from '@tanstack/react-query';

import { gateKeys } from '@/features/gate/api/keys';
import { fetchSummary } from '@/features/gate/api/scan';
import type { ScanSummary } from '@/features/gate/schemas/scan';
import { api } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
class SummaryError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`summary load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

export function useScanSummary(
  eventId: string,
  focused: boolean,
): { summary: ScanSummary | null; stale: boolean; forbidden: boolean } {
  const q = useQuery({
    queryKey: gateKeys.summary(eventId),
    queryFn: async () => {
      const r = await fetchSummary(api, eventId);
      if (!r.ok) throw new SummaryError(r.error);
      return r.value;
    },
    refetchInterval: focused ? 15_000 : false,
    staleTime: 0,
  });
  // Stale on any error, even before the first success, so "— / —" reads "not updated".
  return {
    summary: q.data ?? null,
    stale: q.isError,
    // A hint only: the 403 has no code, so the caller must confirm before showing a refusal.
    forbidden: q.error instanceof SummaryError && q.error.kind === 'forbidden',
  };
}
