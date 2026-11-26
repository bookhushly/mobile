import { useQuery } from '@tanstack/react-query';

import { securityPriceGuide } from '@/features/customer/api/securityApi';
import {
  EMPTY_SECURITY,
  SECURITY_STEPS,
  type Duration,
  type GuardType,
} from '@/features/customer/domain/security/securityRequest';
import { CustomerLoadError, discoverKeys } from '@/features/customer/hooks/customerKeys';
import { makeDraftStore } from '@/features/customer/hooks/draftStore';
import { SECURITY_KIND } from '@/features/customer/hooks/rfqKinds';
import { useRfqRequests } from '@/features/customer/hooks/useCarRequests';
import { api } from '@/shared/api/instance';

/** The security request being built. */
export const useSecurityDraft = makeDraftStore(EMPTY_SECURITY, SECURITY_STEPS, 'check');

/** Security requests through the shared request-for-quote hooks (rfqKinds). */
export const useSecurityRequests = (userId: string) => useRfqRequests(SECURITY_KIND, userId);

/** The guide price for the check step: public, only when state, guards and duration are known. */
export function useSecurityPriceGuide(
  state: string | null,
  guard: GuardType | null,
  duration: Duration | null,
): { min: number; max: number } | null {
  const q = useQuery({
    queryKey: discoverKeys.securityPriceGuide(state, guard, duration),
    queryFn: async ({ signal }) => {
      if (state === null || guard === null || duration === null) return null;
      const r = await securityPriceGuide(api, state, guard, duration, signal);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    enabled: state !== null && guard !== null && duration !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return q.data ?? null;
}
