import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  cancelBooking,
  requestRefund,
  transferTickets,
} from '@/features/customer/api/bookingActionsApi';
import { customerDb } from '@/features/customer/api/customerDb';
import { postReview, type ReviewTarget } from '@/features/customer/api/reviewsApi';
import {
  cancelOutcome,
  refundOutcome,
  reviewOutcome,
  transferOutcome,
  type ActionOutcome,
  type ReviewDone,
} from '@/features/customer/domain/actionOutcome';
import type { BookingKind } from '@/features/customer/domain/myBookings';
import {
  useAction,
  type ActionResult,
  type ActionState,
} from '@/features/customer/hooks/actionState';
import { customerKeys, discoverKeys } from '@/features/customer/hooks/customerKeys';
import { isSignedInAs } from '@/features/customer/hooks/sessionWrite';
import { mayStillLand, unsettled } from '@/features/customer/hooks/unsettled';
import { useRefundRequested, useReviewedSet } from '@/features/customer/hooks/useActionMarks';
import { wallet } from '@/features/customer/offline/wallet';
import { transferRequest, type CancelResult } from '@/features/customer/schemas/actions';
import { api } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

// Spec E5–E8. Every POST is single-flight and never re-sent by the app. A lost answer on an
// irreversible action (cancel, transfer) is settled by re-reading the booking under RLS.

/** The booking, re-read: null when RLS no longer shows it, undefined when the read failed. */
async function reread(
  userId: string,
  kind: BookingKind,
  id: string,
): Promise<{ status: string | null } | null | undefined> {
  if (kind === 'event') {
    const r = await customerDb.event(userId, id);
    return r.ok ? (r.value === null ? null : { status: r.value.status }) : undefined;
  }
  const r =
    kind === 'hotel' ? await customerDb.hotel(userId, id) : await customerDb.apartment(userId, id);
  return r.ok ? (r.value === null ? null : { status: r.value.booking_status }) : undefined;
}

// A 5xx answer: the server was reached and failed the action (final review I2, contract K1).
function serverFailed<T>(r: Result<T, ApiError>): boolean {
  if (r.ok) return false;
  const e = r.error;
  if (e.kind === 'unavailable') return e.status >= 500;
  return e.kind === 'unknown' && e.status !== undefined && e.status >= 500;
}

// The latch for a lost answer is kept only while that answer could still land.
function canSettleAsNotDone(userId: string, kind: BookingKind, id: string): boolean {
  const u = unsettled.get(userId, kind, id);
  return u !== null && !mayStillLand(u, Date.now());
}

// The booking changed on the server: its details, the list (and so the wallet, rewritten by the
// list load) follow.
function refreshBooking(qc: QueryClient, userId: string, kind: BookingKind, id: string): void {
  void qc.invalidateQueries({ queryKey: customerKeys.booking(userId, kind, id) });
  void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
}

/** `null`: the cancel was confirmed by re-reading the booking, so the refund outcome is unknown. */
export type CancelDone = CancelResult | null;

export function useCancelBooking(
  userId: string,
  kind: BookingKind,
  id: string,
): {
  state: ActionState<CancelDone>;
  cancel: () => Promise<ActionResult<CancelDone> | null>;
  /** After `uncertain`: re-read the booking again ("Check again"). Never re-posts. */
  recheck: () => Promise<ActionResult<CancelDone> | null>;
  reset: () => void;
} {
  const qc = useQueryClient();
  const { state, run, reset } = useAction<CancelDone>();

  const settle = useCallback(
    async (first: ActionOutcome<CancelDone>): Promise<ActionResult<CancelDone>> => {
      let o: ActionResult<CancelDone> = first;
      if (o.kind === 'uncertain') {
        const b = await reread(userId, kind, id);
        if (b?.status === 'cancelled') o = { kind: 'done', value: null };
        // Still here and not cancelled, and the answer can no longer land: not cancelled.
        else if (b !== undefined && b !== null && canSettleAsNotDone(userId, kind, id)) {
          o = { kind: 'notDone' };
        }
      }
      // Only a lost answer stays unsettled; any server answer (or a 429 / 401, which never ran
      // the cancel) settles it.
      if (o.kind !== 'uncertain') unsettled.clear(userId, kind, id);
      if (o.kind === 'done') refreshBooking(qc, userId, kind, id);
      return o;
    },
    [qc, userId, kind, id],
  );

  const recheck = useCallback(
    () => run({ kind: 'checking' }, () => settle({ kind: 'uncertain' })),
    [run, settle],
  );
  const cancel = useCallback(() => {
    // An earlier cancel's answer was lost (even from a closed sheet): re-read, never re-post.
    if (unsettled.get(userId, kind, id) !== null) return recheck();
    return run({ kind: 'sending' }, async (show) => {
      unsettled.set(userId, kind, id, {
        action: 'cancel',
        sentAt: Date.now(),
        email: null,
        answered: false,
      });
      const r = await cancelBooking(api, kind, id);
      const u = unsettled.get(userId, kind, id);
      if (u !== null && serverFailed(r)) unsettled.set(userId, kind, id, { ...u, answered: true });
      const o: ActionOutcome<CancelDone> = cancelOutcome(r);
      if (o.kind === 'uncertain') show({ kind: 'checking' });
      return settle(o);
    });
  }, [run, settle, recheck, userId, kind, id]);
  return { state, cancel, recheck, reset };
}

export type TransferDone = { transferredTo: string };

export function useTransferTickets(
  userId: string,
  bookingId: string,
): {
  state: ActionState<TransferDone>;
  transfer: (newEmail: string) => Promise<ActionResult<TransferDone> | null>;
  /** After `uncertain`: re-read the booking again. Never re-posts. */
  recheck: () => Promise<ActionResult<TransferDone> | null>;
  reset: () => void;
} {
  const qc = useQueryClient();
  const { state, run, reset } = useAction<TransferDone>();
  const settle = useCallback(
    async (first: ActionOutcome<TransferDone>): Promise<ActionResult<TransferDone>> => {
      let o: ActionResult<TransferDone> = first;
      const sent = unsettled.get(userId, 'event', bookingId);
      // The booking moves to the new holder: no longer readable means the transfer landed. But
      // an RLS read without this user's session also reads nothing (review 3, finding 2).
      if (o.kind === 'uncertain') {
        const b = await reread(userId, 'event', bookingId);
        if (b === null && (await isSignedInAs(userId))) {
          o = { kind: 'done', value: { transferredTo: sent?.email ?? '' } };
        } else if (
          b !== undefined &&
          b !== null &&
          canSettleAsNotDone(userId, 'event', bookingId)
        ) {
          // Still this user's, and the answer can no longer land: not sent.
          o = { kind: 'notDone' };
        }
      }
      if (o.kind !== 'uncertain') unsettled.clear(userId, 'event', bookingId);
      if (o.kind === 'done') {
        // The tickets leave this device at once (spec E7), then the list reloads without it.
        await isSignedInAs(userId)
          .then((yes) => (yes ? wallet.drop(userId, 'event', bookingId) : undefined))
          .catch(() => undefined);
        qc.removeQueries({ queryKey: customerKeys.booking(userId, 'event', bookingId) });
        qc.removeQueries({ queryKey: customerKeys.liveCodes(userId, bookingId) });
        // The offline copy read from disk would still show it.
        qc.removeQueries({ queryKey: customerKeys.wallet(userId) });
        void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
      }
      return o;
    },
    [qc, userId, bookingId],
  );

  const recheck = useCallback(
    () => run({ kind: 'checking' }, () => settle({ kind: 'uncertain' })),
    [run, settle],
  );
  const transfer = useCallback(
    (newEmail: string) => {
      // An earlier transfer's answer was lost: re-read only, whatever address is typed now.
      if (unsettled.get(userId, 'event', bookingId) !== null) return recheck();
      return run({ kind: 'sending' }, async (show) => {
        // A body the client won't send never sets the latch (final review minor 6).
        const body = transferRequest.safeParse({ new_email: newEmail });
        if (!body.success) return { kind: 'refused', reason: 'invalid' };
        unsettled.set(userId, 'event', bookingId, {
          action: 'transfer',
          sentAt: Date.now(),
          email: body.data.new_email,
          answered: false,
        });
        const r = await transferTickets(api, bookingId, newEmail);
        const u = unsettled.get(userId, 'event', bookingId);
        if (u !== null && serverFailed(r)) {
          unsettled.set(userId, 'event', bookingId, { ...u, answered: true });
        }
        const o = transferOutcome(r);
        if (o.kind === 'uncertain') show({ kind: 'checking' });
        return settle(o);
      });
    },
    [run, settle, recheck, userId, bookingId],
  );
  return { state, transfer, recheck, reset };
}

export function useRefundRequest(
  userId: string,
  bookingId: string,
): {
  state: ActionState<{ id: string }>;
  /** A request was sent from this device (or the server said one exists). */
  requested: boolean;
  send: (reason: string) => Promise<ActionResult<{ id: string }> | null>;
  reset: () => void;
} {
  const { state, run, reset } = useAction<{ id: string }>();
  const marks = useRefundRequested(userId);
  const { mark } = marks;
  const send = useCallback(
    (reason: string) =>
      run({ kind: 'sending' }, async () => {
        const o = refundOutcome(await requestRefund(api, bookingId, reason));
        // Nothing is inferred from an uncertain answer: asking again reads 409 if it landed.
        if (o.kind === 'done' || (o.kind === 'refused' && o.reason === 'alreadyRequested')) {
          await mark(bookingId);
        }
        return o;
      }),
    [run, mark, bookingId],
  );
  return { state, requested: marks.has(bookingId), send, reset };
}

export function usePostReview(
  userId: string,
  target: { listingId: string; type: ReviewTarget } | null,
): {
  state: ActionState<ReviewDone>;
  /** Posted from this device, or the server said it was already reviewed. */
  reviewed: boolean;
  post: (rating: number, comment: string) => Promise<ActionResult<ReviewDone> | null>;
  reset: () => void;
} {
  const qc = useQueryClient();
  const { state, run, reset } = useAction<ReviewDone>();
  const marks = useReviewedSet(userId);
  const { mark } = marks;
  const listingId = target?.listingId ?? null;
  const type = target?.type ?? null;
  const post = useCallback(
    (rating: number, comment: string) =>
      run({ kind: 'sending' }, async () => {
        // No listing (hidden or removed): nothing to review; the offer never shows for one.
        if (listingId === null || type === null) return { kind: 'refused', reason: 'notEligible' };
        const o = reviewOutcome(await postReview(api, listingId, type, rating, comment));
        if (o.kind === 'done') {
          await mark(listingId);
          if (type !== 'event') {
            void qc.invalidateQueries({
              queryKey: [...discoverKeys.all, 'reviews', type, listingId],
            });
          }
        }
        return o;
      }),
    [run, mark, qc, listingId, type],
  );
  return { state, reviewed: listingId !== null && marks.has(listingId), post, reset };
}
