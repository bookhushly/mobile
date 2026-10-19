import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { BookingAction } from '@/features/customer/domain/bookingActions';
import type { ActionResult } from '@/features/customer/hooks/actionState';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { sentNotice } from '@/features/customer/hooks/sentNotice';
import { unsettled } from '@/features/customer/hooks/unsettled';
import {
  useCancelBooking,
  usePostReview,
  useRefundRequest,
  useTransferTickets,
  type TransferDone,
} from '@/features/customer/hooks/useBookingActions';
import type { ProfileRow } from '@/features/customer/schemas/profile';
import { actionFacts, type ActionTarget } from '@/features/customer/ui/actionTarget';
import { CancelSheet } from '@/features/customer/ui/CancelSheet';
import { ManageBooking } from '@/features/customer/ui/ManageBooking';
import { RefundSheet } from '@/features/customer/ui/RefundSheet';
import { ReviewSheet } from '@/features/customer/ui/ReviewSheet';
import { TransferSheet } from '@/features/customer/ui/TransferSheet';
import { clock } from '@/shared/api/instance';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { maskEmail } from '@/shared/lib/maskEmail';

/** iOS: leave this long after closing the sheet if its dismissal never arrives. */
export const LEAVE_FALLBACK_MS = 600;

type Props = {
  userId: string;
  /** The session email: never a transfer recipient. */
  email: string;
  target: ActionTarget;
  today: IsoDate;
  /** After a transfer: leave the booking (it is no longer this user's). */
  onTransferred: () => void;
};

// Spec E9: the Manage booking rows and their sheets. One sheet at a time; a sheet closes before
// the screen navigates (iOS: after it has slid away).
export function BookingActions({ userId, email, target, today, onTransferred }: Props) {
  const { kind, row } = target;
  const f = actionFacts(target, today, clock.serverNow());
  const cancel = useCancelBooking(userId, kind, row.id);
  const refund = useRefundRequest(userId, row.id);
  const transfer = useTransferTickets(userId, row.id);
  const review = usePostReview(userId, f.review);
  const qc = useQueryClient();
  const [open, setOpen] = useState<BookingAction | null>(null);

  // A transfer that landed: navigate once the sheet is gone. If the screen unmounts first (the
  // booking query was dropped), navigate from the cleanup instead.
  const leaving = useRef(false);
  const onLeave = useRef(onTransferred);
  useEffect(() => {
    onLeave.current = onTransferred;
  }, [onTransferred]);
  // iOS: Modal `onDismiss` has been missed under the New Architecture; leave anyway after this.
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (fallback.current !== null) clearTimeout(fallback.current);
      if (leaving.current) {
        leaving.current = false;
        onLeave.current();
      }
    },
    [],
  );
  function leave() {
    if (fallback.current !== null) clearTimeout(fallback.current);
    fallback.current = null;
    if (!leaving.current) return;
    leaving.current = false;
    onLeave.current();
  }
  function afterTransfer(o: ActionResult<TransferDone> | null) {
    if (o?.kind !== 'done') return;
    const to = o.value.transferredTo;
    // Keyed by user (security S1); also tells the details screen not to read "not yours".
    sentNotice.set(userId, row.id, to === '' ? null : maskEmail(to));
    leaving.current = true;
    setOpen(null);
    if (Platform.OS !== 'ios') {
      leave();
      return;
    }
    fallback.current = setTimeout(leave, LEAVE_FALLBACK_MS);
  }

  const latch = unsettled.get(userId, kind, row.id);
  const unsettledCancel = latch?.action === 'cancel' ? latch : null;
  const unsettledTransfer = latch?.action === 'transfer' ? latch : null;
  // Ruling (a): while a lost cancel or transfer is unsettled, Cancel, Transfer and Refund all open
  // the sheet of the action actually sent, so its own Check again (and side effects) settles it.
  const openAction = (a: BookingAction) => {
    setOpen(latch !== null && a !== 'review' ? latch.action : a);
  };
  const profile = qc.getQueryData<ProfileRow | null>(customerKeys.profile(userId));
  const ownEmails = [email, profile?.email ?? ''].filter((e) => e !== '');

  const close = (reset: () => void) => () => {
    reset();
    setOpen(null);
  };

  return (
    <>
      <ManageBooking
        actions={f.actions}
        refundRequested={refund.requested}
        reviewed={review.reviewed}
        onOpen={openAction}
      />
      <CancelSheet
        visible={open === 'cancel'}
        title={f.title}
        when={f.when}
        money={f.money}
        paid={f.paid}
        state={cancel.state}
        unsettled={unsettledCancel !== null}
        onCancel={() => {
          void cancel.cancel();
        }}
        onRecheck={() => {
          void cancel.recheck();
        }}
        onClose={close(cancel.reset)}
      />
      <RefundSheet
        visible={open === 'refund'}
        title={f.title}
        when={f.when}
        state={refund.state}
        onSend={(reason) => {
          void refund.send(reason);
        }}
        onClose={close(refund.reset)}
      />
      <TransferSheet
        visible={open === 'transfer'}
        title={f.title}
        when={f.when}
        tickets={f.tickets}
        ownEmails={ownEmails}
        state={transfer.state}
        unsettled={unsettledTransfer}
        onTransfer={(to) => {
          void transfer.transfer(to).then(afterTransfer);
        }}
        onRecheck={() => {
          void transfer.recheck().then(afterTransfer);
        }}
        onReset={transfer.reset}
        onClose={close(transfer.reset)}
        onDismissed={leave}
      />
      <ReviewSheet
        visible={open === 'review'}
        title={f.title}
        when={f.when}
        state={review.state}
        onPost={(rating, comment) => {
          void review.post(rating, comment);
        }}
        onClose={close(review.reset)}
      />
    </>
  );
}
