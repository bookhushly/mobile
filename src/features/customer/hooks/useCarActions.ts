import { useRef, useState } from 'react';

import { reviewOutcome, type ReviewDone } from '@/features/customer/domain/actionOutcome';
import type { SubmitBody } from '@/features/customer/domain/carRental/carRequest';
import { useAction, type ActionState } from '@/features/customer/hooks/actionState';
import { CAR_KIND, type RfqKind, type RfqRow } from '@/features/customer/hooks/rfqKinds';
import type { CarRequest } from '@/features/customer/schemas/carRental';
import { useRefreshRfq } from '@/features/customer/hooks/useCarRequests';
import { api, clock } from '@/shared/api/instance';
import { isRetryable, type ApiError } from '@/shared/lib/errors';

/**
 * How a write ended, in what the screen can do next. `tryAgain` covers network, timeouts, 429 and
 * 5xx: never a refusal (CLAUDE.md). `refused` carries the server's reason code.
 */
export type CarWrite<T = undefined> =
  | { kind: 'ok'; value: T }
  | { kind: 'tryAgain' }
  | { kind: 'signIn' }
  | { kind: 'refused'; code: string };

export function writeResult<T>(
  r: { ok: true; value: T } | { ok: false; error: ApiError },
): CarWrite<T> {
  if (r.ok) return { kind: 'ok', value: r.value };
  const e = r.error;
  if (e.kind === 'auth') return { kind: 'signIn' };
  if (isRetryable(e)) return { kind: 'tryAgain' };
  switch (e.kind) {
    case 'conflict':
      return { kind: 'refused', code: e.code };
    case 'forbidden':
      return { kind: 'refused', code: 'forbidden' };
    case 'notFound':
      return { kind: 'refused', code: 'not_found' };
    case 'unknown':
      return { kind: 'refused', code: e.code ?? 'bad_request' };
    case 'validation':
      // The answer didn't parse: the write may have landed, so the screen re-reads.
      return { kind: 'tryAgain' };
    case 'network':
    case 'timeout':
    case 'rateLimited':
    case 'unavailable':
    case 'aborted':
      return { kind: 'tryAgain' };
  }
}

/** A request this lost answer may have created: same trip, made in the last few minutes. */
export const LOST_ANSWER_WINDOW_MS = 10 * 60_000;

/**
 * Sends a new request. One at a time: a second tap while sending does nothing. A lost answer
 * (timeout, network, unreadable reply) may still have created it, so the list is read before
 * saying "try again": a matching request made in the last few minutes counts as sent, and the
 * customer never sends the same trip twice.
 */
export function useSubmitRfq<R extends RfqRow, B>(
  kind: RfqKind<R, B>,
  userId: string,
): {
  send: (body: B) => Promise<CarWrite<{ id: string }>>;
  sending: boolean;
} {
  const refresh = useRefreshRfq(kind, userId);
  const [sending, setSending] = useState(false);
  // A ref, not state: the auto-send after sign-in and a tap can land in the same render.
  const inFlight = useRef(false);
  const send = async (body: B) => {
    if (inFlight.current) return { kind: 'tryAgain' } as const;
    inFlight.current = true;
    setSending(true);
    try {
      const out = writeResult(await kind.submit(api, body));
      if (out.kind === 'ok') {
        await refresh(out.value.id);
        return out;
      }
      if (out.kind !== 'tryAgain') return out;
      const list = await kind.list(api);
      if (!list.ok) return out;
      const now = clock.serverNow();
      const landed = list.value.requests.find(
        (r) =>
          r.status === 'open' &&
          kind.sameAs(r, body) &&
          now - Date.parse(r.createdAt) < LOST_ANSWER_WINDOW_MS,
      );
      if (landed === undefined) return out;
      await refresh(landed.id);
      return { kind: 'ok', value: { id: landed.id } } as const;
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  return { send, sending };
}

type Action = 'select' | 'cancel' | 'confirm';

/** Choose a quote, cancel, confirm the trip's done. Each re-reads the request after. */
export function useRfqActions<R extends RfqRow, B>(
  kind: RfqKind<R, B>,
  userId: string,
  id: string,
): {
  busy: Action | null;
  select: (offerId: string) => Promise<CarWrite<unknown>>;
  /** `refund: 'unknown'` when the cancel's own answer was lost and a re-read showed it landed. */
  cancel: (reason: string) => Promise<CarWrite<{ refund: 'none' | 'pending' | 'unknown' }>>;
  confirmDone: () => Promise<CarWrite<unknown>>;
} {
  const refresh = useRefreshRfq(kind, userId);
  const [busy, setBusy] = useState<Action | null>(null);
  // Single flight on a ref: a second tap before React re-renders does nothing.
  const inFlight = useRef(false);
  async function run<T>(
    a: Action,
    call: () => Promise<{ ok: true; value: T } | { ok: false; error: ApiError }>,
  ): Promise<CarWrite<T>> {
    if (inFlight.current) return { kind: 'tryAgain' };
    inFlight.current = true;
    setBusy(a);
    try {
      const out = writeResult(await call());
      // A refusal (e.g. someone else's change got there first) also means the screen is stale.
      if (out.kind !== 'tryAgain') await refresh(id);
      return out;
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  /** A lost answer or a retry's 409 may hide a write that landed: read back what the request says. */
  async function landed(test: (r: R) => boolean): Promise<boolean> {
    const r = await kind.get(api, id);
    return r.ok && test(r.value);
  }
  return {
    busy,
    // A lost answer (or a retry's 409) may hide the customer's own successful choice: the request
    // is read back, and if this offer is now the chosen one, it was chosen.
    select: async (offerId) => {
      const out = await run('select', () => kind.select(api, id, offerId));
      if (out.kind === 'ok' || out.kind === 'signIn') return out;
      return (await landed((r) => r.status === 'matched' && r.selectedOffer?.id === offerId))
        ? { kind: 'ok', value: undefined }
        : out;
    },
    cancel: async (reason) => {
      const out = await run<{ refund: 'none' | 'pending' | 'unknown' }>('cancel', () =>
        kind.cancel(api, id, reason),
      );
      if (out.kind === 'ok' || out.kind === 'signIn') return out;
      return (await landed((r) => r.status === 'cancelled' || r.status === 'refunded'))
        ? { kind: 'ok', value: { refund: 'unknown' } }
        : out;
    },
    confirmDone: async () => {
      const out = await run('confirm', () => kind.confirm(api, id));
      if (out.kind === 'ok' || out.kind === 'signIn') return out;
      return (await landed((r) => r.status === 'completed'))
        ? { kind: 'ok', value: undefined }
        : out;
    },
  };
}

/** The trip review in the shared ReviewSheet: a 409 `already_reviewed` counts as done. */
export function useRfqReview<R extends RfqRow, B>(
  kind: RfqKind<R, B>,
  userId: string,
  id: string,
): {
  state: ActionState<ReviewDone>;
  post: (rating: number, comment: string) => void;
  reset: () => void;
} {
  const refresh = useRefreshRfq(kind, userId);
  const a = useAction<ReviewDone>();
  return {
    state: a.state,
    post: (rating, comment) => {
      void a.run({ kind: 'sending' }, async () => {
        const o = reviewOutcome(await kind.review(api, id, rating, comment));
        if (o.kind === 'done') await refresh(id);
        return o;
      });
    },
    reset: a.reset,
  };
}

// Car rental names, kept for the car screens.
export const useSubmitCarRequest = (userId: string) =>
  useSubmitRfq<CarRequest, SubmitBody>(CAR_KIND, userId);
export const useCarActions = (userId: string, id: string) => useRfqActions(CAR_KIND, userId, id);
export const useCarReview = (userId: string, id: string) => useRfqReview(CAR_KIND, userId, id);
