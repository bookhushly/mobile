import {
  SAMPLE_FEE_RATE,
  sampleRequest,
  sampleRequests,
  sampleSendQuote,
  sampleVehicles,
  sampleWithdraw,
} from '@/features/vendor/api/sampleRequests';
import {
  sampleComplete,
  sampleJob,
  sampleJobs,
  sampleMilestone,
  sampleStart,
} from '@/features/vendor/api/sampleJobs';
import {
  sampleEarnings,
  sampleWithdraw as sampleWithdrawMoney,
} from '@/features/vendor/api/sampleEarnings';
import {
  sampleBooking,
  sampleBookings,
  sampleApartments,
  sampleCalendar,
  sampleEvents,
  sampleMoveBooking,
  sampleToggleBlocked,
} from '@/features/vendor/api/sampleListings';
import { sampleToday } from '@/features/vendor/api/sampleToday';
import type { ListingBooking, StayStatus, VendorEvent } from '@/features/vendor/domain/listings';
import type { IsoDate } from '@/shared/lib/lagosDay';
import type { Activity, Earnings } from '@/features/vendor/domain/earnings';
import type { Milestone, VendorJob } from '@/features/vendor/domain/jobs';
import type {
  MyOffer,
  RequestDetail,
  Vehicle,
  VendorRequest,
} from '@/features/vendor/domain/requests';
import type { VendorToday } from '@/features/vendor/domain/today';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import { createVendorHttp } from '@/features/vendor/api/vendorHttp';
import { vendorDb } from '@/features/vendor/api/vendorDb';
import type { VendorApartment } from '@/features/vendor/domain/calendarBlocks';
import { isQuoteKind } from '@/features/vendor/domain/vendorProfile';
import { api } from '@/shared/api/instance';
import { VENDOR_LIVE_DATA } from '@/shared/config/features';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

/**
 * Every vendor read goes through here. Today it's sample data (vendor mode is dev-only); each read
 * moves to its web route as it ships (docs/superpowers/specs/2026-11-25-vendor-web-routes.md).
 */
export type VendorSource = {
  today(kind: ServedKind, nowMs: number): Promise<Result<VendorToday, ApiError>>;
  requests(kind: ServedKind, nowMs: number): Promise<Result<VendorRequest[], ApiError>>;
  request(kind: ServedKind, id: string, nowMs: number): Promise<Result<RequestDetail, ApiError>>;
  vehicles(kind: ServedKind): Promise<Result<Vehicle[], ApiError>>;
  /** Bookhushly's fee as a fraction of the quote (server setting). */
  /** Null when it can't be known yet (no past job to read it from). */
  feeRate(kind: ServedKind): Promise<Result<number | null, ApiError>>;
  /** `idempotencyKey`: the same key on a retry never sends a second quote (web spec §4). */
  sendQuote(
    kind: ServedKind,
    id: string,
    quote: { amount: number; message: string; vehicleId: string | null; idempotencyKey: string },
    nowMs: number,
  ): Promise<Result<MyOffer, ApiError>>;
  withdrawQuote(kind: ServedKind, id: string, nowMs: number): Promise<Result<MyOffer, ApiError>>;
  jobs(kind: ServedKind, nowMs: number): Promise<Result<VendorJob[], ApiError>>;
  job(kind: ServedKind, id: string, nowMs: number): Promise<Result<VendorJob, ApiError>>;
  startJob(kind: ServedKind, id: string, nowMs: number): Promise<Result<VendorJob, ApiError>>;
  /** Logistics; `delivered` needs the uploaded proof photo and completes the job. */
  milestone(
    kind: ServedKind,
    id: string,
    milestone: Milestone,
    photoUri: string | null,
    nowMs: number,
  ): Promise<Result<VendorJob, ApiError>>;
  completeJob(kind: ServedKind, id: string, nowMs: number): Promise<Result<VendorJob, ApiError>>;
  earnings(kind: ServedKind, nowMs: number): Promise<Result<Earnings, ApiError>>;
  /** A request Bookhushly checks before sending; `idempotencyKey` stops a retry paying out twice. */
  withdraw(
    kind: ServedKind,
    amount: number,
    idempotencyKey: string,
    nowMs: number,
  ): Promise<Result<Activity, ApiError>>;
  /** Hotels and apartments (`GET /api/vendor/bookings` on the web). */
  bookings(kind: ServedKind, nowMs: number): Promise<Result<ListingBooking[], ApiError>>;
  booking(kind: ServedKind, id: string, nowMs: number): Promise<Result<ListingBooking, ApiError>>;
  /** Apartments: `POST /api/vendor/apartment-bookings/{id}/status`; refused if it moved from `from`. */
  moveBooking(
    kind: ServedKind,
    id: string,
    from: StayStatus,
    to: StayStatus,
    nowMs: number,
  ): Promise<Result<ListingBooking, ApiError>>;
  /** Apartments: the vendor's own, for the calendar. */
  apartments(vendorId: string): Promise<Result<VendorApartment[], ApiError>>;
  /** One apartment's month (`month`: any day in it): nights booked by guests, and blocked by you. */
  calendar(
    apartmentId: string,
    month: IsoDate,
    nowMs: number,
  ): Promise<Result<{ booked: IsoDate[]; blocked: IsoDate[] }, ApiError>>;
  /** True when the night ends up blocked; a booked night is refused (`date_booked`). */
  toggleBlocked(
    apartmentId: string,
    date: IsoDate,
    nowMs: number,
  ): Promise<Result<boolean, ApiError>>;
  events(nowMs: number): Promise<Result<VendorEvent[], ApiError>>;
};

const sampleSource: VendorSource = {
  today: (kind, nowMs) => Promise.resolve(ok(sampleToday(kind, nowMs))),
  requests: (kind, nowMs) => Promise.resolve(ok(sampleRequests(kind, nowMs))),
  request: (kind, id, nowMs) => Promise.resolve(sampleRequest(kind, id, nowMs)),
  vehicles: (kind) => Promise.resolve(ok(sampleVehicles(kind))),
  feeRate: () => Promise.resolve(ok(SAMPLE_FEE_RATE)),
  sendQuote: (kind, id, quote, nowMs) =>
    Promise.resolve(sampleSendQuote(kind, id, quote.amount, nowMs)),
  withdrawQuote: (kind, id, nowMs) => Promise.resolve(sampleWithdraw(kind, id, nowMs)),
  jobs: (kind, nowMs) => Promise.resolve(ok(sampleJobs(kind, nowMs))),
  job: (kind, id, nowMs) => Promise.resolve(sampleJob(kind, id, nowMs)),
  startJob: (kind, id, nowMs) => Promise.resolve(sampleStart(kind, id, nowMs)),
  milestone: (kind, id, m, photoUri, nowMs) =>
    Promise.resolve(sampleMilestone(kind, id, m, photoUri, nowMs)),
  completeJob: (kind, id, nowMs) => Promise.resolve(sampleComplete(kind, id, nowMs)),
  earnings: (kind, nowMs) => Promise.resolve(ok(sampleEarnings(kind, nowMs))),
  withdraw: (kind, amount, _key, nowMs) =>
    Promise.resolve(sampleWithdrawMoney(kind, amount, nowMs)),
  bookings: (kind, nowMs) => Promise.resolve(ok(sampleBookings(kind, nowMs))),
  booking: (kind, id, nowMs) => Promise.resolve(sampleBooking(kind, id, nowMs)),
  moveBooking: (kind, id, from, to, nowMs) =>
    Promise.resolve(sampleMoveBooking(kind, id, from, to, nowMs)),
  apartments: () => Promise.resolve(ok(sampleApartments())),
  calendar: (_apartmentId, _month, nowMs) => Promise.resolve(ok(sampleCalendar(nowMs))),
  toggleBlocked: (_apartmentId, date, nowMs) => Promise.resolve(sampleToggleBlocked(date, nowMs)),
  events: (nowMs) => Promise.resolve(ok(sampleEvents(nowMs))),
};

/** Live routes where they exist; sample data for events and for hotels' Today and Earnings. */
function liveSource(): VendorSource {
  const http = createVendorHttp(api);
  return {
    ...sampleSource,
    today: (kind, nowMs) =>
      isQuoteKind(kind) ? http.today(kind, nowMs) : sampleSource.today(kind, nowMs),
    requests: (kind) => http.requests(kind),
    request: (kind, id) => http.request(kind, id),
    // No fleet route yet: no vehicle to pick (web spec follow-up).
    vehicles: () => Promise.resolve(ok([])),
    feeRate: () => http.feeRate(),
    sendQuote: (kind, id, quote) => http.sendQuote(kind, id, quote),
    withdrawQuote: (kind, id) => http.withdrawQuote(kind, id),
    jobs: () => http.jobs(),
    job: (kind, id) => http.job(kind, id),
    startJob: (kind, id) => http.startJob(kind, id),
    milestone: (kind, id, m, photoUri) => http.milestone(kind, id, m, photoUri),
    completeJob: (kind, id) => http.completeJob(kind, id),
    earnings: (kind, nowMs) =>
      isQuoteKind(kind) ? http.earnings(nowMs) : sampleSource.earnings(kind, nowMs),
    // Only wallet vendors withdraw here; a hotel's Earnings is still sample data, so no real debit.
    withdraw: (kind, amount, key) =>
      isQuoteKind(kind)
        ? http.withdraw(amount, key)
        : Promise.resolve(err({ kind: 'forbidden', code: 'wrong_category' })),
    bookings: (kind) => http.bookings(kind),
    booking: (kind, id) => http.booking(kind, id),
    moveBooking: (kind, id, from, to) => http.moveBooking(kind, id, from, to),
    apartments: (vendorId) => vendorDb.apartments(vendorId),
    calendar: (apartmentId, month) => http.calendar(apartmentId, month),
    toggleBlocked: (apartmentId, date) => http.toggleBlocked(apartmentId, date),
  };
}

export const vendorSource: VendorSource = VENDOR_LIVE_DATA ? liveSource() : sampleSource;
