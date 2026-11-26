import type {
  OpenRequest,
  RequestType,
  TodayJob,
  VendorToday,
} from '@/features/vendor/domain/today';
import { sampleJobs } from '@/features/vendor/api/sampleJobs';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import { lagosToday } from '@/shared/lib/lagosDay';

// SAMPLE DATA for vendor mode while the web vendor routes don't exist (plan 2026-11-25, slice 8
// swaps each read for HTTP). Vendor mode is off in production builds, so none of this is ever
// shown to a real vendor. Times are relative to `nowMs` so the screen always looks current.

const MIN = 60_000;
const HOUR = 60 * MIN;
const iso = (ms: number) => new Date(ms).toISOString();

function series(total: number, days: number): number[] {
  // A steady month with paydays every few days: cumulative, ending on `total`.
  const out: number[] = [];
  let sum = 0;
  for (let d = 1; d <= days; d++) {
    if (d % 3 === 2 || d === days) sum = Math.round((total * d) / days);
    out.push(sum);
  }
  return out;
}

function month(nowMs: number, now: number, then: number) {
  const d = new Date(nowMs + HOUR); // Lagos day of month
  const day = d.getUTCDate();
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return { now: series(now, day), then: series(then, day), daysInMonth };
}

const req = (requestType: RequestType, partial: Omit<OpenRequest, 'requestType'>): OpenRequest => ({
  requestType,
  ...partial,
});

function logistics(nowMs: number): VendorToday {
  return {
    jobs: [],
    requests: [
      req('logistics', {
        id: 'sample-req-1',
        title: 'Move a 2-bed flat',
        summary: 'Lekki → Yaba · Sat 6 Dec',
        closesAt: iso(nowMs + 5 * HOUR),
        quotes: 2,
        photo: 'truck',
      }),
      req('logistics', {
        id: 'sample-req-2',
        title: 'Deliver 4 boxes',
        summary: 'Ikeja → Ajah · Mon 1 Dec',
        closesAt: iso(nowMs + 22 * HOUR),
        quotes: 0,
        photo: 'van',
      }),
      req('logistics', {
        id: 'sample-req-3',
        title: 'Office furniture',
        summary: 'Ikoyi → Surulere · Wed 3 Dec',
        closesAt: iso(nowMs + 40 * HOUR),
        quotes: 1,
        photo: 'delivery',
      }),
    ],
    wallet: { available: 326_500, held: 86_000, heldJobs: 2 },
    month: month(nowMs, 412_500, 348_500),
  };
}

function carRental(nowMs: number): VendorToday {
  return {
    jobs: [],
    requests: [
      req('car_rental', {
        id: 'sample-req-1',
        title: 'SUV for 3 days, self-drive',
        summary: 'Lagos · Fri 5 – Mon 8 Dec',
        closesAt: iso(nowMs + 7 * HOUR),
        quotes: 3,
        photo: 'suv',
      }),
      req('car_rental', {
        id: 'sample-req-2',
        title: 'Wedding convoy, 4 cars',
        summary: 'Ikoyi · Sat 13 Dec',
        closesAt: iso(nowMs + 30 * HOUR),
        quotes: 1,
        photo: 'sedan',
      }),
    ],
    wallet: { available: 210_000, held: 45_000, heldJobs: 1 },
    month: month(nowMs, 520_000, 610_000),
  };
}

function security(nowMs: number): VendorToday {
  return {
    jobs: [],
    requests: [
      req('security', {
        id: 'sample-req-1',
        title: 'Night guards for an office',
        summary: 'Ikeja · from Mon 1 Dec',
        closesAt: iso(nowMs + 12 * HOUR),
        quotes: 2,
        photo: 'security',
      }),
    ],
    wallet: { available: 540_000, held: 180_000, heldJobs: 1 },
    month: month(nowMs, 960_000, 880_000),
  };
}

/** Today's jobs come from the same sample jobs the Jobs screens change, so both always agree. */
function todayJobs(kind: ServedKind, nowMs: number): TodayJob[] {
  const today = lagosToday(nowMs);
  const out: TodayJob[] = [];
  for (const j of sampleJobs(kind, nowMs)) {
    if (lagosToday(Date.parse(j.startsAt)) !== today) continue;
    if (j.status !== 'paid' && j.status !== 'in_progress') continue;
    out.push({
      id: j.id,
      requestType: j.requestType,
      title: j.title,
      startsAt: j.startsAt,
      from: j.from,
      to: j.to,
      customerName: j.customer.name,
      payout: j.payout,
      stage: j.status === 'paid' ? 'paid' : j.vendorCompletedAt === null ? 'inProgress' : 'done',
      photo: j.photo,
    });
  }
  return out;
}

export function sampleToday(kind: ServedKind, nowMs: number): VendorToday {
  return { ...pick(kind, nowMs), jobs: todayJobs(kind, nowMs) };
}

function pick(kind: ServedKind, nowMs: number): VendorToday {
  switch (kind) {
    case 'carRental':
      return carRental(nowMs);
    case 'security':
      return security(nowMs);
    case 'logistics':
    case 'hotel':
    case 'apartment':
    case 'event':
      return logistics(nowMs);
  }
}
