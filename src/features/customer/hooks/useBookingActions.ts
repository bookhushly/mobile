import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

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
import { useAction, type ActionState } from '@/features/customer/hooks/actionState';
import { customerKeys, discoverKeys } from '@/features/customer/hooks/customerKeys';
import { isSignedInAs } from '@/features/customer/hooks/sessionWrite';
import { useRefundRequested, useReviewedSet } from '@/features/customer/hooks/useActionMarks';
import { wallet } from '@/features/customer/offline/wallet';
import type { CancelResult } from '@/features/customer/schemas/actions';
import { api } from '@/shared/api/instance';

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
  cancel: () => Promise<ActionOutcome<CancelDone> | null>;
  /** After `uncertain`: re-read the booking again ("Check again"). Never re-posts. */
  recheck: () => Promise<ActionOutcome<CancelDone> | null>;
  reset: () => void;
} {
  const qc = useQueryClient();
  const { state, run, reset } = useAction<CancelDone>();

  const settle = useCallback(
    async (o: ActionOutcome<CancelDone>): Promise<ActionOutcome<CancelDone>> => {
      if (o.kind === 'uncertain') {
        const b = await reread(userId, kind, id);
        if (b?.status === 'cancelled') o = { kind: 'done', value: null };
      }
      if (o.kind === 'done') refreshBooking(qc, userId, kind, id);
      return o;
    },
    [qc, userId, kind, id],
  );

  const cancel = useCallback(
    () =>
      run({ kind: 'sending' }, async (show) => {
        const o: ActionOutcome<CancelDone> = cancelOutcome(await cancelBooking(api, kind, id));
        if (o.kind === 'uncertain') show({ kind: 'checking' });
        return settle(o);
      }),
    [run, settle, kind, id],
  );
  const recheck = useCallback(
    () => run({ kind: 'checking' }, () => settle({ kind: 'uncertain' })),
    [run, settle],
  );
  return { state, cancel, recheck, reset };
}

export type TransferDone = { transferredTo: string };

export function useTransferTickets(
  userId: string,
  bookingId: string,
): {
  state: ActionState<TransferDone>;
  transfer: (newEmail: string) => Promise<ActionOutcome<TransferDone> | null>;
  /** After `uncertain`: re-read the booking again. Never re-posts. */
  recheck: () => Promise<ActionOutcome<TransferDone> | null>;
  reset: () => void;
} {
  const qc = useQueryClient();
  const { state, run, reset } = useAction<TransferDone>();
  const sentTo = useRef('');

  const settle = useCallback(
    async (o: ActionOutcome<TransferDone>): Promise<ActionOutcome<TransferDone>> => {
      // The booking moves to the new holder: no longer readable means the transfer landed.
      if (o.kind === 'uncertain' && (await reread(userId, 'event', bookingId)) === null) {
        o = { kind: 'done', value: { transferredTo: sentTo.current } };
      }
      if (o.kind === 'done') {
        // The tickets leave this device at once (spec E7), then the list reloads without it.
        await isSignedInAs(userId)
          .then((yes) => (yes ? wallet.drop(userId, 'event', bookingId) : undefined))
          .catch(() => undefined);
        qc.removeQueries({ queryKey: customerKeys.booking(userId, 'event', bookingId) });
        qc.removeQueries({ queryKey: customerKeys.liveCodes(userId, bookingId) });
        void qc.invalidateQueries({ queryKey: customerKeys.bookings(userId) });
      }
      return o;
    },
    [qc, userId, bookingId],
  );

  const transfer = useCallback(
    (newEmail: string) =>
      run({ kind: 'sending' }, async (show) => {
        sentTo.current = newEmail.trim().toLowerCase();
        const o = transferOutcome(await transferTickets(api, bookingId, newEmail));
        if (o.kind === 'uncertain') show({ kind: 'checking' });
        return settle(o);
      }),
    [run, settle, bookingId],
  );
  const recheck = useCallback(
    () => run({ kind: 'checking' }, () => settle({ kind: 'uncertain' })),
    [run, settle],
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
  send: (reason: string) => Promise<ActionOutcome<{ id: string }> | null>;
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
  post: (rating: number, comment: string) => Promise<ActionOutcome<ReviewDone> | null>;
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
