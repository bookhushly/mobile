import { z } from 'zod';

import {
  byOfferStatus,
  earningsFrom,
  feeRateFrom,
  jobFrom,
  myOfferFrom,
  offerRequestFrom,
  requestDetailFrom,
  requestFrom,
  stayFrom,
} from '@/features/vendor/api/mapVendor';
import type { Activity, Earnings } from '@/features/vendor/domain/earnings';
import type { Milestone, VendorJob } from '@/features/vendor/domain/jobs';
import type { ListingBooking, StayStatus } from '@/features/vendor/domain/listings';
import type { MyOffer, RequestDetail, VendorRequest } from '@/features/vendor/domain/requests';
import type { RequestType, TodayJob, VendorToday } from '@/features/vendor/domain/today';
import {
  vendorKind,
  vendorStanding,
  type ServedKind,
  type VendorProfile,
} from '@/features/vendor/domain/vendorProfile';
import {
  bankBody,
  jobBody,
  jobsBody,
  meBody,
  moveBody,
  offerBody,
  offersBody,
  requestBody,
  requestsBody,
  staysBody,
  transactionsBody,
  uploadBody,
  walletBody,
  withdrawBody,
  type ApiJob,
} from '@/features/vendor/schemas/vendorApi';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import { lagosToday } from '@/shared/lib/lagosDay';
import { err, ok, type Result } from '@/shared/lib/result';

// The vendor routes (web `docs/mobile/VENDOR_API.md`, PR #248) for car rental, logistics and
// security companies, and the wallet. Writes are never retried by the client except withdraw,
// whose key the server stores; a lost quote is settled by the one-pending-offer rule (409).

type Requester = Pick<ApiClient, 'request'>;
type R<T> = Promise<Result<T, ApiError>>;

const SEGMENT: Record<RequestType, string> = {
  car_rental: 'car-rental',
  logistics: 'logistics',
  security: 'security',
};
const TYPE: Partial<Record<ServedKind, RequestType>> = {
  carRental: 'car_rental',
  logistics: 'logistics',
  security: 'security',
};

function typeOf(kind: ServedKind): Result<RequestType, ApiError> {
  const t = TYPE[kind];
  return t === undefined ? err({ kind: 'forbidden', code: 'wrong_category' }) : ok(t);
}

const one = (t: RequestType, id: string) => `${SEGMENT[t]}/${encodeURIComponent(id)}`;

/** How long a vendor read is shared between screens (the routes allow 30 calls a minute per user). */
const SHARE_MS = 20_000;

export function createVendorHttp(raw: Requester, now: () => number = () => Date.now()) {
  // Today, Requests and Earnings read the same few endpoints: each is fetched once and shared for
  // a short while (concurrent reads join the one in flight); any write drops everything.
  const shared = new Map<string, { at: number; p: Promise<Result<unknown, ApiError>> }>();
  const c: Requester = {
    request: <T>(
      path: string,
      opts: Parameters<Requester['request']>[1] & { schema: z.ZodType<T> },
    ) => {
      if (opts.method !== undefined && opts.method !== 'GET') {
        shared.clear();
        return raw.request(path, opts);
      }
      const hit = shared.get(path);
      if (hit !== undefined && now() - hit.at < SHARE_MS)
        return hit.p as Promise<Result<T, ApiError>>;
      const p = raw.request(path, opts);
      shared.set(path, { at: now(), p });
      // A failed read is never shared: the next screen asks again.
      void p.then((r) => {
        if (!r.ok) shared.delete(path);
      });
      return p;
    },
  };
  const jobsRaw = (): R<ApiJob[]> =>
    c
      .request('/api/vendor/rfq/jobs', { schema: jobsBody })
      .then((r) => (r.ok ? ok(r.value.jobs) : r));
  const transactions = () =>
    c.request('/api/wallet/transactions?limit=100', { schema: transactionsBody });

  const toJobs = (raw: ApiJob[]): VendorJob[] =>
    raw.map(jobFrom).filter((j): j is VendorJob => j !== null);

  async function requests(kind: ServedKind): R<VendorRequest[]> {
    const t = typeOf(kind);
    if (!t.ok) return t;
    // New: requests I can quote. Quoted and Won: my offers (the open list leaves those out).
    const [open, mine] = await Promise.all([
      c.request('/api/vendor/rfq/requests?page=1&pageSize=50', { schema: requestsBody }),
      c.request('/api/vendor/rfq/offers', { schema: offersBody }),
    ]);
    if (!open.ok) return open;
    if (!mine.ok) return mine;
    const quoted = mine.value.offers
      .map(offerRequestFrom)
      .filter((x): x is VendorRequest => x !== null)
      .sort(byOfferStatus);
    // One row per request: the latest offer wins (the list is newest first).
    const seen = new Set<string>();
    const fromOffers = quoted.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
    return ok([...open.value.requests.map((x) => requestFrom(x, t.value)), ...fromOffers]);
  }

  async function earnings(nowMs: number): R<Earnings> {
    const [w, j, t, b] = await Promise.all([
      c.request('/api/wallet', { schema: walletBody }),
      jobsRaw(),
      transactions(),
      c.request('/api/vendor/bank-details', { schema: bankBody }),
    ]);
    if (!w.ok) return w;
    if (!j.ok) return j;
    if (!t.ok) return t;
    // No bank on file reads as null fields, not an error; a failed read must not hide the money.
    const bank = b.ok ? b.value.data : null;
    return ok(
      earningsFrom({
        balance: w.value.data.balance,
        jobs: j.value,
        transactions: t.value.data,
        bank,
        nowMs,
      }),
    );
  }

  async function stays(kind: ServedKind): R<ListingBooking[]> {
    const r = await c.request('/api/vendor/bookings', { schema: staysBody });
    if (!r.ok) return r;
    const want = kind === 'hotel' ? 'hotel' : 'apartment';
    return ok(
      r.value.bookings
        .map(stayFrom)
        .filter((b): b is ListingBooking => b !== null && b.kind === want),
    );
  }

  return {
    bookings: stays,

    async booking(kind: ServedKind, id: string): R<ListingBooking> {
      const r = await stays(kind);
      if (!r.ok) return r;
      const b = r.value.find((x) => x.id === id);
      return b === undefined ? err({ kind: 'notFound' }) : ok(b);
    },

    /** Apartments: confirm, decline, check in, check out. */
    async moveBooking(
      kind: ServedKind,
      id: string,
      from: StayStatus,
      to: StayStatus,
    ): R<ListingBooking> {
      if (kind !== 'apartment') return err({ kind: 'forbidden', code: 'wrong_category' });
      // The route checks the move against the status it reads, not the one the vendor saw: a
      // booking confirmed elsewhere a moment ago must not be cancelled by a stale "Decline". Read it
      // fresh and refuse if it moved (a small window remains until the web takes an expected status).
      shared.clear();
      const fresh = await stays(kind);
      if (!fresh.ok) return fresh;
      const current = fresh.value.find((x) => x.id === id);
      if (current === undefined) return err({ kind: 'notFound' });
      if (current.status !== from) return err({ kind: 'conflict', code: 'stale_status' });
      const r = await c.request(`/api/vendor/apartment-bookings/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: { status: to },
        schema: moveBody,
      });
      if (!r.ok) return r;
      const after = await stays(kind);
      if (!after.ok) return after;
      const b = after.value.find((x) => x.id === id);
      return b === undefined ? err({ kind: 'notFound' }) : ok(b);
    },

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

    requests,

    async request(kind: ServedKind, id: string): R<RequestDetail> {
      const t = typeOf(kind);
      if (!t.ok) return t;
      const r = await c.request(`/api/vendor/rfq/requests/${one(t.value, id)}`, {
        schema: requestBody,
      });
      if (!r.ok) return r;
      const offer = r.value.myOffer === null ? null : myOfferFrom(r.value.myOffer);
      return ok(requestDetailFrom(r.value.request, t.value, offer));
    },

    async feeRate(): R<number | null> {
      const j = await jobsRaw();
      return j.ok ? ok(feeRateFrom(j.value)) : j;
    },

    async sendQuote(
      kind: ServedKind,
      id: string,
      q: { amount: number; message: string; vehicleId: string | null; idempotencyKey: string },
    ): R<MyOffer> {
      const t = typeOf(kind);
      if (!t.ok) return t;
      const body: Record<string, unknown> = { amount: q.amount, idempotency_key: q.idempotencyKey };
      if (q.message !== '') body['message'] = q.message;
      if (q.vehicleId !== null && t.value !== 'security') body['vehicle_id'] = q.vehicleId;
      const r = await c.request(`/api/vendor/rfq/requests/${one(t.value, id)}/offers`, {
        method: 'POST',
        body,
        schema: offerBody,
      });
      if (r.ok) return ok(myOfferFrom(r.value.offer));
      // A retry after a lost answer: the server already has this quote, and says so with it.
      if (r.error.kind === 'conflict' && r.error.code === 'already_offered') {
        const existing = alreadyOffered.safeParse(r.error.body);
        // Only the same quote counts as sent: an edited amount is the earlier quote, not this one.
        if (
          existing.success &&
          existing.data.offer !== null &&
          existing.data.offer.amount === q.amount
        )
          return ok(myOfferFrom(existing.data.offer));
      }
      return r;
    },

    async withdrawQuote(kind: ServedKind, requestId: string): R<MyOffer> {
      const t = typeOf(kind);
      if (!t.ok) return t;
      // The route takes the offer id: read it off the request first.
      const d = await c.request(`/api/vendor/rfq/requests/${one(t.value, requestId)}`, {
        schema: requestBody,
      });
      if (!d.ok) return d;
      const offer = d.value.myOffer;
      if (offer === null) return err({ kind: 'conflict', code: 'offer_not_pending' });
      const r = await c.request(`/api/vendor/rfq/offers/${encodeURIComponent(offer.id)}/withdraw`, {
        method: 'POST',
        schema: offerBody,
      });
      return r.ok ? ok(myOfferFrom(r.value.offer)) : r;
    },

    async jobs(): R<VendorJob[]> {
      const j = await jobsRaw();
      return j.ok ? ok(toJobs(j.value)) : j;
    },

    async job(kind: ServedKind, id: string): R<VendorJob> {
      const t = typeOf(kind);
      if (!t.ok) return t;
      const r = await c.request(`/api/vendor/rfq/jobs/${one(t.value, id)}`, { schema: jobBody });
      if (!r.ok) return r;
      const j = jobFrom(r.value.job);
      return j === null ? err({ kind: 'notFound', code: 'cancelled' }) : ok(j);
    },

    async startJob(kind: ServedKind, id: string): R<VendorJob> {
      return jobAction(kind, id, 'start');
    },

    async completeJob(kind: ServedKind, id: string): R<VendorJob> {
      return jobAction(kind, id, 'complete');
    },

    async milestone(
      kind: ServedKind,
      id: string,
      m: Milestone,
      photoUri: string | null,
    ): R<VendorJob> {
      if (kind !== 'logistics') return err({ kind: 'forbidden', code: 'wrong_category' });
      const body: Record<string, unknown> = { milestone: m };
      if (m === 'delivered') {
        if (photoUri === null) return err({ kind: 'conflict', code: 'photo_required' });
        const up = await upload(photoUri, 'proof');
        if (!up.ok) return up;
        body['photo_url'] = up.value;
      }
      const r = await c.request(
        `/api/vendor/rfq/jobs/logistics/${encodeURIComponent(id)}/milestone`,
        {
          method: 'POST',
          body,
          schema: jobBody,
        },
      );
      if (!r.ok) return r;
      const j = jobFrom(r.value.job);
      return j === null ? err({ kind: 'notFound', code: 'cancelled' }) : ok(j);
    },

    earnings,

    async withdraw(amount: number, idempotencyKey: string): R<Activity> {
      const r = await c.request('/api/wallet/withdraw', {
        method: 'POST',
        body: { amount, idempotency_key: idempotencyKey },
        schema: withdrawBody,
        // The key is stored: a retry after a timeout or 503 can never debit twice.
        idempotent: true,
      });
      if (!r.ok) return r;
      const w = r.value.withdrawal;
      return ok({
        id: w.id,
        kind: 'withdrawal',
        title: 'To your bank',
        at: new Date().toISOString(),
        amount: w.amount,
        status: WITHDRAWAL_STATUS[w.status] ?? 'pending',
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

  async function jobAction(
    kind: ServedKind,
    id: string,
    action: 'start' | 'complete',
  ): R<VendorJob> {
    const t = typeOf(kind);
    if (!t.ok) return t;
    const r = await c.request(`/api/vendor/rfq/jobs/${one(t.value, id)}/${action}`, {
      method: 'POST',
      schema: jobBody,
    });
    if (!r.ok) return r;
    const j = jobFrom(r.value.job);
    return j === null ? err({ kind: 'notFound', code: 'cancelled' }) : ok(j);
  }

  async function upload(uri: string, folder: 'proof' | 'offers'): R<string> {
    const form = new FormData();
    // React Native's FormData takes a file as { uri, name, type }.
    form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    form.append('folder', folder);
    // A photo on a slow mobile connection needs longer than a JSON call.
    const r = await c.request('/api/upload', {
      method: 'POST',
      body: form,
      schema: uploadBody,
      timeoutMs: 60_000,
    });
    return r.ok ? ok(r.value.url) : r;
  }
}

const WITHDRAWAL_STATUS: Record<string, Activity['status']> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  rejected: 'failed',
};

const alreadyOffered = z.object({
  offer: z
    .object({
      id: z.string(),
      request_id: z.string(),
      request_type: z.string(),
      amount: z.number(),
      status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn', 'expired']),
      created_at: z.string(),
      expires_at: z.string().nullable().optional(),
    })
    .nullable(),
});
