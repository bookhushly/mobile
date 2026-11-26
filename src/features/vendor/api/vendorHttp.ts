import type { TodayJob, VendorToday } from '@/features/vendor/domain/today';
import {
  vendorKind,
  vendorStanding,
  type ServedKind,
  type VendorProfile,
} from '@/features/vendor/domain/vendorProfile';
import { meBody } from '@/features/vendor/schemas/vendorApi';

import { lagosToday } from '@/shared/lib/lagosDay';
import { ok } from '@/shared/lib/result';
import { createCalendarHttp } from '@/features/vendor/api/calendarHttp';
import { createMoneyHttp } from '@/features/vendor/api/moneyHttp';
import { createRfqHttp } from '@/features/vendor/api/rfqHttp';
import { createStaysHttp } from '@/features/vendor/api/staysHttp';
import {
  createSharedRequester,
  type R,
  type Requester,
} from '@/features/vendor/api/vendorHttpCommon';

// The live vendor layer: requests, quotes and jobs (rfqHttp), the wallet (moneyHttp), hotel and
// apartment stays (staysHttp), sharing one short-lived read cache (vendorHttpCommon).

export function createVendorHttp(raw: Requester, now: () => number = () => Date.now()) {
  const { c, clear } = createSharedRequester(raw, now);
  const rfq = createRfqHttp(c);
  const money = createMoneyHttp(c, rfq.jobsRaw);
  const st = createStaysHttp(c, clear);
  const cal = createCalendarHttp(c, clear);
  const { requests, jobsRaw, toJobs } = rfq;
  const { earnings } = money;
  return {
    ...rfq,
    ...money,
    ...st,
    ...cal,

    async me(): R<VendorProfile & { states: string[] }> {
      const r = await c.request('/api/vendor/me', { schema: meBody });
      if (!r.ok) return r;
      const v = r.value.vendor;
      return ok({
        id: v.id,
        name: v.business_name.trim(),
        kind: vendorKind(v.business_category),
        standing: vendorStanding({
          approved: v.approved === true,
          status: v.status,
          suspendedAt: v.suspended ? 'suspended' : null,
          rejectionReason: v.rejection_reason,
        }),
        states: v.states,
      });
    },

    async today(kind: ServedKind, nowMs: number): R<VendorToday> {
      const [reqs, e, j] = await Promise.all([requests(kind), earnings(nowMs), jobsRaw()]);
      if (!reqs.ok) return reqs;
      if (!e.ok) return e;
      if (!j.ok) return j;
      const today = lagosToday(nowMs);
      const jobs: TodayJob[] = toJobs(j.value)
        .filter((x) => x.startsAt !== '' && lagosToday(Date.parse(x.startsAt)) === today)
        .filter((x) => x.status === 'paid' || x.status === 'in_progress')
        .map((x) => ({
          id: x.id,
          requestType: x.requestType,
          title: x.title,
          startsAt: x.startsAt,
          from: x.from,
          to: x.to,
          customerName: x.customer.name,
          payout: x.payout,
          stage:
            x.status === 'paid' ? 'paid' : x.vendorCompletedAt === null ? 'inProgress' : 'done',
          photo: x.photo,
        }));
      const open = reqs.value.filter((x) => x.myOffer === null);
      return ok({
        jobs,
        requests: open,
        wallet: e.value.wallet ?? { available: 0, held: 0, heldJobs: 0 },
        month: e.value.month,
      });
    },
  };
}
