import { chargeEstimate, payableTotal } from '@/features/customer/domain/checkout/reviewText';
import { useServiceCharge } from '@/features/customer/hooks/useCheckoutData';

export type ChargeNote = 'checking' | 'unknown' | null;

/**
 * Select's footer preview: `base` (the estimate after any promo) plus the service charge estimate.
 * The server recomputes. A charge that hasn't been read is never part of the total, and `note` says
 * so, as Price details does on Pay. Null `base`: nothing chosen yet, so nothing to say.
 */
export function useSelectTotal(
  kind: 'hotel' | 'apartment' | 'event',
  base: number | null,
): { total: number | null; note: ChargeNote } {
  const q = useServiceCharge(kind);
  if (base === null) return { total: null, note: null };
  const total = payableTotal(base, chargeEstimate(base, q.data ?? null));
  if (q.data !== undefined) return { total, note: null };
  return { total, note: q.isError ? 'unknown' : 'checking' };
}
