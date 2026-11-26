import { useQuery } from '@tanstack/react-query';

import { vendorSource } from '@/features/vendor/api/vendorSource';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import { vendorKeys } from '@/features/vendor/hooks/useVendor';
import { vendorRetry } from '@/features/vendor/hooks/vendorErrors';
import { clock } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';

class TodayLoadError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`vendor today load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

export function useVendorToday(vendorId: string, kind: ServedKind) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.today(vendorId),
    queryFn: async () => {
      const r = await vendorSource.today(kind, clock.serverNow());
      if (!r.ok) throw new TodayLoadError(r.error);
      return r.value;
    },
  });
}
