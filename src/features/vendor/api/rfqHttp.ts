import { z } from 'zod';

import {
  byOfferStatus,
  feeRateFrom,
  jobFrom,
  myOfferFrom,
  offerRequestFrom,
  requestDetailFrom,
  requestFrom,
} from '@/features/vendor/api/mapVendor';

import type { Milestone, VendorJob } from '@/features/vendor/domain/jobs';

import type { MyOffer, RequestDetail, VendorRequest } from '@/features/vendor/domain/requests';

import { type ServedKind } from '@/features/vendor/domain/vendorProfile';
import {
  jobBody,
  jobsBody,
  offerBody,
  offersBody,
  requestBody,
  requestsBody,
  uploadBody,
  type ApiJob,
} from '@/features/vendor/schemas/vendorApi';

import { err, ok } from '@/shared/lib/result';
import { one, typeOf, type R, type Requester } from '@/features/vendor/api/vendorHttpCommon';

/** Requests, quotes and jobs for car rental, logistics and security companies. */
export function createRfqHttp(c: Requester) {
  const jobsRaw = (): R<ApiJob[]> =>
    c
      .request('/api/vendor/rfq/jobs', { schema: jobsBody })
      .then((r) => (r.ok ? ok(r.value.jobs) : r));
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

  return {
    jobsRaw,
    toJobs,
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
  };
}

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
