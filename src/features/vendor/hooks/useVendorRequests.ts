import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useRef } from 'react';

import { vendorSource } from '@/features/vendor/api/vendorSource';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import { vendorKeys } from '@/features/vendor/hooks/useVendor';
import { otherRefusal, vendorRetry } from '@/features/vendor/hooks/vendorErrors';
import { clock } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
export class VendorError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`vendor call failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

async function unwrap<T>(p: Promise<Result<T, ApiError>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new VendorError(r.error);
  return r.value;
}

type Who = { vendorId: string; kind: ServedKind };

export function useVendorRequests({ vendorId, kind }: Who) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.requests(vendorId),
    queryFn: () => unwrap(vendorSource.requests(kind, clock.serverNow())),
  });
}

export function useVendorRequest({ vendorId, kind }: Who, id: string) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.request(vendorId, id),
    queryFn: () => unwrap(vendorSource.request(kind, id, clock.serverNow())),
  });
}

export function useQuoteSetup({ vendorId, kind }: Who) {
  const vehicles = useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.vehicles(vendorId),
    queryFn: () => unwrap(vendorSource.vehicles(kind)),
  });
  const feeRate = useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.feeRate(vendorId),
    queryFn: () => unwrap(vendorSource.feeRate(kind)),
  });
  return { vehicles, feeRate };
}

/** After a quote changes: the lists, the request and Today all read again. */
function useRefresh(vendorId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: vendorKeys.requests(vendorId) }),
      qc.invalidateQueries({ queryKey: vendorKeys.today(vendorId) }),
    ]);
}

export type QuoteInput = { amount: number; message: string; vehicleId: string | null };

/**
 * Send a quote. One idempotency key per request screen visit, kept across retries, so a retry
 * after a lost response can never send a second quote (web spec §4: 409 `already_offered`).
 */
export function useSendQuote({ vendorId, kind }: Who, id: string) {
  const key = useRef<string | null>(null);
  const refresh = useRefresh(vendorId);
  return useMutation({
    mutationFn: (q: QuoteInput) => {
      key.current ??= Crypto.randomUUID();
      return unwrap(
        vendorSource.sendQuote(kind, id, { ...q, idempotencyKey: key.current }, clock.serverNow()),
      );
    },
    onSettled: refresh,
  });
}

export function useWithdrawQuote({ vendorId, kind }: Who, id: string) {
  const refresh = useRefresh(vendorId);
  return useMutation({
    mutationFn: () => unwrap(vendorSource.withdrawQuote(kind, id, clock.serverNow())),
    onSettled: refresh,
  });
}

export type QuoteProblem = { title: string; message: string; transient: boolean };

/** In words for the vendor. A transient failure is never a refusal (CLAUDE.md). */
export function quoteErrorWords(e: unknown): QuoteProblem {
  const a = e instanceof VendorError ? e.apiError : null;
  const refusal = (title: string, message: string) => ({ title, message, transient: false });
  if (a?.kind === 'conflict' && a.code === 'already_offered')
    return refusal('You’ve already quoted', 'Your earlier quote is still with the customer.');
  if (a?.kind === 'conflict' && a.code === 'request_not_open')
    return refusal('This request has closed', 'The customer has chosen or the time ran out.');
  if (a?.kind === 'conflict' && a.code === 'offer_not_pending')
    return refusal('This quote can’t be withdrawn', 'The customer has already answered it.');
  if (a?.kind === 'forbidden')
    return refusal('Your account can’t quote right now', 'Open bookhushly.com to see why.');
  const other = otherRefusal(a);
  if (other !== null) return other;
  return {
    title: 'We couldn’t reach Bookhushly',
    message: 'We couldn’t confirm it went through. Try again: it won’t be sent twice.',
    transient: true,
  };
}
