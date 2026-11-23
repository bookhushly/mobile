import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  carPriceGuide,
  getCarRequest,
  listCarRequests,
} from '@/features/customer/api/carRentalApi';
import type { PricingModel, VehicleType } from '@/features/customer/domain/carRental/carRequest';
import { requestStage } from '@/features/customer/domain/carRental/carStatus';
import {
  CustomerLoadError,
  customerKeys,
  discoverKeys,
} from '@/features/customer/hooks/customerKeys';
import { apiErrorOf } from '@/features/customer/hooks/discoverRetry';
import { loadFailed } from '@/features/customer/hooks/loadState';
import type { CarRequest } from '@/features/customer/schemas/carRental';
import { api, clock } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';

/** While quotes can still arrive, the open request is read again this often (the bell says too). */
export const QUOTES_POLL_MS = 60_000;

export function useCarRequests(userId: string): {
  requests: CarRequest[] | null;
  loading: boolean;
  failed: boolean;
  refetch: () => Promise<unknown>;
} {
  const q = useQuery({
    queryKey: customerKeys.carRequests(userId),
    queryFn: async ({ signal }) => {
      const r = await listCarRequests(api, signal);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value.requests;
    },
    enabled: userId !== '',
  });
  return {
    requests: q.data ?? null,
    loading: userId !== '' && q.isPending && !loadFailed(q),
    failed: loadFailed(q),
    refetch: q.refetch,
  };
}

export function useCarRequest(
  userId: string,
  id: string,
): {
  request: CarRequest | null;
  loading: boolean;
  failed: boolean;
  error: ApiError | null;
  refetch: () => Promise<unknown>;
  isStale: boolean;
} {
  const q = useQuery({
    queryKey: customerKeys.carRequest(userId, id),
    queryFn: async ({ signal }) => {
      const r = await getCarRequest(api, id, signal);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    enabled: userId !== '' && id !== '',
    refetchInterval: (query) => {
      const r = query.state.data;
      if (r === undefined) return false;
      const s = requestStage(r, clock.serverNow());
      return s === 'waiting' || s === 'quotes' ? QUOTES_POLL_MS : false;
    },
  });
  // Signed out, or a malformed id from the route: never queried, never an endless skeleton.
  if (userId === '' || id === '') {
    return {
      request: null,
      loading: false,
      failed: true,
      error: userId === '' ? { kind: 'auth' } : { kind: 'notFound' },
      refetch: q.refetch,
      isStale: false,
    };
  }
  return {
    request: q.data ?? null,
    loading: q.isPending && !loadFailed(q),
    failed: loadFailed(q),
    error: apiErrorOf(q.error),
    refetch: q.refetch,
    isStale: q.isStale,
  };
}

/** After any write: the request and the list are both read again. */
export function useRefreshCarRequest(userId: string): (id: string) => Promise<void> {
  const qc = useQueryClient();
  return async (id: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: customerKeys.carRequest(userId, id) }),
      qc.invalidateQueries({ queryKey: customerKeys.carRequests(userId) }),
    ]);
  };
}

/** The guide price for the check step: public, and only when both choices are made. */
export function useCarPriceGuide(
  state: string | null,
  vehicleType: VehicleType | null,
  pricingModel: PricingModel | null,
): { min: number; max: number } | null {
  const q = useQuery({
    queryKey: discoverKeys.carPriceGuide(state, vehicleType, pricingModel),
    queryFn: async ({ signal }) => {
      if (state === null || vehicleType === null || pricingModel === null) return null;
      const r = await carPriceGuide(api, state, vehicleType, pricingModel, signal);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    enabled: state !== null && vehicleType !== null && pricingModel !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return q.data ?? null;
}
