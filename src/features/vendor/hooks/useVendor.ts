import { useQuery } from '@tanstack/react-query';

import { vendorDb } from '@/features/vendor/api/vendorDb';
import type { VendorProfile } from '@/features/vendor/domain/vendorProfile';
import { vendorRetry } from '@/features/vendor/hooks/vendorErrors';
import type { ApiError } from '@/shared/lib/errors';

export const vendorKeys = {
  me: (userId: string) => ['vendor', 'me', userId] as const,
  today: (vendorId: string) => ['vendor', 'today', vendorId] as const,
  requests: (vendorId: string) => ['vendor', 'requests', vendorId] as const,
  request: (vendorId: string, id: string) => ['vendor', 'requests', vendorId, id] as const,
  vehicles: (vendorId: string) => ['vendor', 'vehicles', vendorId] as const,
  feeRate: (vendorId: string) => ['vendor', 'feeRate', vendorId] as const,
  jobs: (vendorId: string) => ['vendor', 'jobs', vendorId] as const,
  earnings: (vendorId: string) => ['vendor', 'earnings', vendorId] as const,
  bookings: (vendorId: string) => ['vendor', 'bookings', vendorId] as const,
  booking: (vendorId: string, id: string) => ['vendor', 'bookings', vendorId, id] as const,
  calendar: (vendorId: string) => ['vendor', 'calendar', vendorId] as const,
  events: (vendorId: string) => ['vendor', 'events', vendorId] as const,
  job: (vendorId: string, id: string) => ['vendor', 'jobs', vendorId, id] as const,
};

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
class VendorLoadError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`vendor load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

export type VendorState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'none' }
  | { status: 'ready'; vendor: VendorProfile };

/** The signed-in vendor's own business. `none`: no vendors row yet (finish signing up on the web). */
export function useVendor(userId: string): VendorState {
  const q = useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.me(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const r = await vendorDb.me(userId);
      if (!r.ok) throw new VendorLoadError(r.error);
      return r.value;
    },
  });
  if (q.isPending) return { status: 'loading' };
  if (q.isError) return { status: 'error', retry: () => void q.refetch() };
  return q.data === null ? { status: 'none' } : { status: 'ready', vendor: q.data };
}
