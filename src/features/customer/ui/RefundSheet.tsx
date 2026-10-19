import { useState, type ReactNode } from 'react';

import type { ActionState } from '@/features/customer/hooks/actionState';
import { ActionDone } from '@/features/customer/ui/ActionDone';
import { reasonError } from '@/features/customer/ui/actionInput';
import { REFUND_ALREADY, refundNotice } from '@/features/customer/ui/actionText';
import { BookingSummary } from '@/features/customer/ui/BookingSummary';
import { CharCounter } from '@/features/customer/ui/CharCounter';
import { RateLimitWait } from '@/features/customer/ui/RateLimitWait';
import { REFUND_REASON_MAX } from '@/features/customer/schemas/actions';
import { Banner, Button, Input, Sheet, Stack, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  title: string;
  when: string;
  state: ActionState<{ id: string }>;
  onSend: (reason: string) => void;
  onClose: () => void;
};

// Spec E6 (Mobbin §5: the cancel sheet's layout): a required reason with a counter, then
// Send request. A duplicate (409) reads as already asked, never as an error.
export function RefundSheet({ visible, title, when, state, onSend, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const busy = state.kind === 'sending';
  const error = tried ? reasonError(reason) : null;
  const already = state.kind === 'refused' && state.reason === 'alreadyRequested';

  function close() {
    if (busy) return;
    setReason('');
    setTried(false);
    onClose();
  }

  function send() {
    setTried(true);
    if (busy || reasonError(reason) !== null) return;
    onSend(reason.trim());
  }

  let body: ReactNode;
  let footer: ReactNode;
  if (state.kind === 'done' || already) {
    body =
      state.kind === 'done' ? (
        <ActionDone title="Request sent" message="The organiser reviews it and we’ll notify you." />
      ) : (
        <ActionDone title="Refund requested" message={REFUND_ALREADY} />
      );
    footer = <Button label="Done" onPress={close} />;
  } else {
    const notice =
      state.kind === 'idle' || state.kind === 'sending' || state.kind === 'checking'
        ? null
        : refundNotice(state);
    body = (
      <Stack gap="s4">
        <BookingSummary title={title} when={when} />
        <Text variant="body" tone="textSecondary">
          The organiser reviews refund requests. We’ll notify you when they decide.
        </Text>
        <Input
          label="Reason"
          value={reason}
          onChangeText={setReason}
          onBlur={() => {
            if (reason !== '') setTried(true);
          }}
          multiline
          maxLength={REFUND_REASON_MAX}
          textAlignVertical="top"
          editable={!busy}
          error={error ?? undefined}
          testID="refund-reason"
        />
        <CharCounter length={reason.length} max={REFUND_REASON_MAX} />
        {notice !== null ? (
          <Banner tone={notice.tone} message={notice.message} testID="refund-notice" />
        ) : null}
        {state.kind === 'rateLimited' ? (
          <RateLimitWait retryAfterSec={state.retryAfterSec} />
        ) : null}
      </Stack>
    );
    footer =
      state.kind === 'refused' || state.kind === 'signedOut' ? (
        <Button variant="secondary" label="Back to booking" onPress={close} />
      ) : (
        <Button label="Send request" loading={busy} onPress={send} />
      );
  }

  return (
    <Sheet
      visible={visible}
      title="Ask for a refund"
      onClose={close}
      closeDisabled={busy}
      footer={footer}
      scroll
      testID="refund-sheet"
    >
      {body}
    </Sheet>
  );
}
