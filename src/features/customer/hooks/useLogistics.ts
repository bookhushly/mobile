import { useQuery } from '@tanstack/react-query';

import { logisticsPriceGuide } from '@/features/customer/api/logisticsApi';
import type {
  LogisticsBody,
  LogisticsVehicle,
} from '@/features/customer/domain/logistics/logisticsRequest';
import { CustomerLoadError, discoverKeys } from '@/features/customer/hooks/customerKeys';
import { LOGISTICS_KIND } from '@/features/customer/hooks/rfqKinds';
import { useRfqActions, useRfqReview, useSubmitRfq } from '@/features/customer/hooks/useCarActions';
import { useRfqPayment } from '@/features/customer/hooks/useCarPayment';
import { useRfqRequest, useRfqRequests } from '@/features/customer/hooks/useCarRequests';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import { api } from '@/shared/api/instance';

// Logistics through the shared request-for-quote hooks (rfqKinds).
export const useLogisticsRequests = (userId: string) => useRfqRequests(LOGISTICS_KIND, userId);
export const useLogisticsRequest = (userId: string, id: string) =>
  useRfqRequest(LOGISTICS_KIND, userId, id);
export const useSubmitLogistics = (userId: string) =>
  useSubmitRfq<LogisticsRequest, LogisticsBody>(LOGISTICS_KIND, userId);
export const useLogisticsActions = (userId: string, id: string) =>
  useRfqActions(LOGISTICS_KIND, userId, id);
export const useLogisticsReview = (userId: string, id: string) =>
  useRfqReview(LOGISTICS_KIND, userId, id);
export const useLogisticsPayment = (userId: string, id: string, matched: boolean) =>
  useRfqPayment(LOGISTICS_KIND, userId, id, matched);

/** The guide price for the check step: public, only when the state and vehicle are known. */
export function useLogisticsPriceGuide(
  state: string | null,
  vehicle: LogisticsVehicle | null,
): { min: number; max: number } | null {
  const q = useQuery({
    queryKey: discoverKeys.logisticsPriceGuide(state, vehicle),
    queryFn: async ({ signal }) => {
      if (state === null || vehicle === null) return null;
      const r = await logisticsPriceGuide(api, state, vehicle, signal);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    enabled: state !== null && vehicle !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return q.data ?? null;
}
