import type { VendorJob } from '@/features/vendor/domain/jobs';

import type { ApiJob } from '@/features/vendor/schemas/vendorApi';

import { isDate, photoFor, titleFor } from '@/features/vendor/api/mapWords';

/** A Lagos date and `HH:MM` as an instant (Lagos is UTC+1 all year). */
function lagosInstant(date: string | null | undefined, time: string | null | undefined): string {
  if (!isDate(date)) return '';
  const t = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '00:00';
  return new Date(Date.parse(`${date}T${t}:00+01:00`)).toISOString();
}

export function jobFrom(j: ApiJob): VendorJob | null {
  const s = j.status;
  if (
    s !== 'matched' &&
    s !== 'paid' &&
    s !== 'in_progress' &&
    s !== 'completed' &&
    s !== 'disputed'
  )
    return null;
  const type = j.request_type;
  const security = type === 'security';
  const from = security ? (j.state ?? '') : (j.pickup_address ?? j.pickup_state ?? '');
  const to = security
    ? null
    : type === 'logistics'
      ? (j.delivery_address ?? j.delivery_state ?? null)
      : (j.destination_address ?? j.destination_state ?? null);
  const toShort = security
    ? null
    : type === 'logistics'
      ? (j.delivery_state ?? null)
      : (j.destination_state ?? null);
  return {
    id: j.id,
    requestType: type,
    title: titleFor(type, j),
    startsAt: security
      ? lagosInstant(j.start_date, null)
      : lagosInstant(j.pickup_date, j.pickup_time),
    from,
    to,
    toShort,
    customer: { name: j.customer_first_name ?? 'The customer', phone: j.customer_phone ?? null },
    paid: j.selected_offer?.amount ?? 0,
    payout: j.payout_amount ?? 0,
    status: s,
    vendorCompletedAt: j.vendor_completed_at ?? null,
    milestones: {
      pickedUpAt: j.picked_up_at ?? null,
      inTransitAt: j.in_transit_at ?? null,
      deliveredAt: j.delivered_at ?? null,
    },
    photo: photoFor(type, j),
  };
}

/** Bookhushly's fee, read off past jobs (the server works out the payout but doesn't send the rate). */
export function feeRateFrom(jobs: readonly ApiJob[]): number | null {
  for (const j of jobs) {
    const price = j.selected_offer?.amount;
    if (price && j.payout_amount !== null && j.payout_amount !== undefined && price > 0)
      return Math.round((1 - j.payout_amount / price) * 100) / 100;
  }
  return null;
}
