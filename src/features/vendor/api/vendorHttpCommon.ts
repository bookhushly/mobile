import { z } from 'zod';

import type { RequestType } from '@/features/vendor/domain/today';
import { type ServedKind } from '@/features/vendor/domain/vendorProfile';

import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';

import { err, ok, type Result } from '@/shared/lib/result';

// The vendor routes (web `docs/mobile/VENDOR_API.md`, PR #248): what every part of the live layer
// shares. Writes are never retried by the client except withdraw, whose key the server stores; a
// lost quote is settled by the one-pending-offer rule (409).

export type Requester = Pick<ApiClient, 'request'>;
export type R<T> = Promise<Result<T, ApiError>>;

export const SEGMENT: Record<RequestType, string> = {
  car_rental: 'car-rental',
  logistics: 'logistics',
  security: 'security',
};
export const TYPE: Partial<Record<ServedKind, RequestType>> = {
  carRental: 'car_rental',
  logistics: 'logistics',
  security: 'security',
};

export function typeOf(kind: ServedKind): Result<RequestType, ApiError> {
  const t = TYPE[kind];
  return t === undefined ? err({ kind: 'forbidden', code: 'wrong_category' }) : ok(t);
}

export const one = (t: RequestType, id: string) => `${SEGMENT[t]}/${encodeURIComponent(id)}`;

/** How long a vendor read is shared between screens (the routes allow 30 calls a minute per user). */
const SHARE_MS = 20_000;

/**
 * Today, Requests and Earnings read the same few endpoints: each is fetched once and shared for a
 * short while (concurrent reads join the one in flight); any write drops everything.
 */
export function createSharedRequester(raw: Requester, now: () => number) {
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
  return {
    c,
    clear: () => {
      shared.clear();
    },
  };
}
