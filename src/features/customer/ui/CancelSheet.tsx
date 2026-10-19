import { useState, type ReactNode } from 'react';

import type { MoneyLine } from '@/features/customer/domain/bookingActions';
import type { ActionState } from '@/features/customer/hooks/actionState';
import type { CancelDone } from '@/features/customer/hooks/useBookingActions';
import { ActionDone } from '@/features/customer/ui/ActionDone';
import {
  CANCEL_UNSURE,
  cancelNotice,
  cancelRefundLine,
  MONEY_LINE,
  type Notice,
} from '@/features/customer/ui/actionText';
import { BookingSummary } from '@/features/customer/ui/BookingSummary';
import { RateLimitWait } from '@/features/customer/ui/RateLimitWait';
import { Banner, Button, Inline, Sheet, Spinner, Stack, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  title: string;
  when: string;
  money: MoneyLine;
  paid: boolean;
  state: ActionState<CancelDone>;
  /** An earlier cancel's answer was lost: the sheet opens on "Check again". */
  unsettled: boolean;
  onCancel: () => void;
  onRecheck: () => void;
  onClose: () => void;
};

// Spec E5 (Airbnb / Tripadvisor): what is cancelled and the honest money line, "This can't be
// undone", then a destructive Cancel booking and Keep booking. The server decides.
export function CancelSheet(p: Props) {
  const { state } = p;
  // Final review I1: the refetch after a cancel flips payment to refunded, so the refund line
  // uses whether it was paid when the cancel was sent.
  const [paidAtSend, setPaidAtSend] = useState(p.paid);
  const [seen, setSeen] = useState(state.kind);
  if (seen !== state.kind) {
    setSeen(state.kind);
    if (state.kind === 'sending') setPaidAtSend(p.paid);
  }
  const busy = state.kind === 'sending' || state.kind === 'checking';
  const unsure = state.kind === 'uncertain' || (state.kind === 'idle' && p.unsettled);
  const notice: Notice | null = unsure
    ? { tone: 'neutral', message: CANCEL_UNSURE }
    : state.kind === 'refused' ||
        state.kind === 'rateLimited' ||
        state.kind === 'signedOut' ||
        state.kind === 'notDone'
      ? cancelNotice(state)
      : null;

  let body: ReactNode;
  let footer: ReactNode;
  if (state.kind === 'done') {
    // A cancel confirmed by re-reading has no refund result: no refund words then.
    body = (
      <ActionDone title="Booking cancelled" message={cancelRefundLine(state.value, paidAtSend)} />
    );
    footer = <Button label="Done" onPress={p.onClose} />;
  } else {
    body = (
      <Stack gap="s4">
        <BookingSummary title={p.title} when={p.when}>
          <Text variant="bodyStrong">{MONEY_LINE[p.money]}</Text>
        </BookingSummary>
        <Text variant="bodyStrong">This can’t be undone.</Text>
        {state.kind === 'checking' ? (
          <Inline gap="s2">
            <Spinner tone="textSecondary" />
            <Text variant="bodySm" tone="textSecondary" accessibilityLiveRegion="polite">
              Checking your booking…
            </Text>
          </Inline>
        ) : null}
        {notice !== null ? (
          <Banner tone={notice.tone} message={notice.message} testID="cancel-notice" />
        ) : null}
        {state.kind === 'rateLimited' ? (
          <RateLimitWait retryAfterSec={state.retryAfterSec} />
        ) : null}
      </Stack>
    );
    if (unsure || state.kind === 'checking') {
      footer = (
        <Button label="Check again" loading={state.kind === 'checking'} onPress={p.onRecheck} />
      );
    } else if (state.kind === 'refused' || state.kind === 'signedOut') {
      footer = <Button variant="secondary" label="Back to booking" onPress={p.onClose} />;
    } else {
      footer = (
        <Stack gap="s3">
          <Button
            variant="destructive"
            label="Cancel booking"
            loading={state.kind === 'sending'}
            onPress={p.onCancel}
          />
          <Button variant="secondary" label="Keep booking" disabled={busy} onPress={p.onClose} />
        </Stack>
      );
    }
  }

  return (
    <Sheet
      visible={p.visible}
      title="Cancel booking"
      onClose={p.onClose}
      closeDisabled={busy}
      footer={footer}
      scroll
      testID="cancel-sheet"
    >
      {body}
    </Sheet>
  );
}
