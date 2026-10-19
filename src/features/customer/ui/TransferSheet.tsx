import { useState, type ReactNode } from 'react';

import type { ActionState } from '@/features/customer/hooks/actionState';
import type { TransferDone } from '@/features/customer/hooks/useBookingActions';
import { ActionDone } from '@/features/customer/ui/ActionDone';
import { checkEmail } from '@/features/customer/ui/actionInput';
import { TRANSFER_UNSURE, transferNotice, type Notice } from '@/features/customer/ui/actionText';
import { TransferReview } from '@/features/customer/ui/TransferReview';
import { maskEmail } from '@/shared/lib/maskEmail';
import { Button, Input, Sheet, Stack, Text } from '@/shared/ui';

/** RFC 5321's longest address (security review S5). */
export const EMAIL_MAX = 254;

type Props = {
  visible: boolean;
  title: string;
  when: string;
  tickets: number;
  /** This user's emails (session, profile): never a recipient. */
  ownEmails: readonly string[];
  state: ActionState<TransferDone>;
  /** An earlier transfer's answer was lost: the address it went to (the sheet opens on "Check again"). */
  unsettled: { email: string | null } | null;
  onTransfer: (email: string) => void;
  onRecheck: () => void;
  /** Back to idle (leaving a refusal to fix the address). */
  onReset: () => void;
  onClose: () => void;
  /** iOS: the sheet has slid away (navigate after a transfer only then). */
  onDismissed?: () => void;
};

// Spec E7 (Live Nation, Posh): the email, then a review step, then a destructive Transfer tickets.
// The success step is brief: the screen leaves the booking (it is no longer yours).
export function TransferSheet(p: Props) {
  const { state } = p;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const busy = state.kind === 'sending' || state.kind === 'checking';
  const unsure = state.kind === 'uncertain' || (state.kind === 'idle' && p.unsettled !== null);
  const sentTo = email ?? p.unsettled?.email ?? null;

  function close() {
    if (busy) return;
    setText('');
    setError(null);
    setEmail(null);
    p.onClose();
  }

  function next() {
    const r = checkEmail(text, p.ownEmails);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setEmail(r.email);
  }

  function back() {
    if (busy) return;
    p.onReset();
    setEmail(null);
  }

  let body: ReactNode;
  let footer: ReactNode;
  if (state.kind === 'done') {
    const doneTo = state.value.transferredTo || (sentTo ?? '');
    body = (
      <ActionDone
        title="Tickets sent"
        message={doneTo === '' ? null : `Sent to ${maskEmail(doneTo)}`}
      />
    );
    footer = <Button label="Done" onPress={close} />;
  } else if (unsure || sentTo !== null) {
    const notice: Notice | null = unsure
      ? { tone: 'neutral', message: TRANSFER_UNSURE }
      : state.kind === 'refused' || state.kind === 'rateLimited' || state.kind === 'signedOut'
        ? transferNotice(state)
        : null;
    body = (
      <TransferReview
        title={p.title}
        when={p.when}
        tickets={p.tickets}
        email={sentTo}
        checking={state.kind === 'checking'}
        notice={notice}
      />
    );
    footer =
      unsure || state.kind === 'checking' ? (
        <Button label="Check again" loading={state.kind === 'checking'} onPress={p.onRecheck} />
      ) : (
        <Stack gap="s3">
          {state.kind === 'refused' || state.kind === 'signedOut' ? null : (
            <Button
              variant="destructive"
              label="Transfer tickets"
              loading={state.kind === 'sending'}
              onPress={() => {
                if (email !== null && !busy) p.onTransfer(email);
              }}
            />
          )}
          <Button variant="secondary" label="Back" disabled={busy} onPress={back} />
        </Stack>
      );
  } else {
    body = (
      <Stack gap="s4">
        <Text variant="displaySm" accessibilityRole="header">
          Who are you sending them to?
        </Text>
        <Text variant="body" tone="textSecondary">
          They’ll get the tickets by email and see them in their Bookhushly account.
        </Text>
        <Input
          label="Their email"
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (error !== null) setError(null);
          }}
          onBlur={() => {
            if (text.trim() !== '') {
              const r = checkEmail(text, p.ownEmails);
              setError(r.ok ? null : r.error);
            }
          }}
          keyboardType="email-address"
          maxLength={EMAIL_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="next"
          onSubmitEditing={next}
          error={error ?? undefined}
          testID="transfer-email"
        />
      </Stack>
    );
    footer = <Button label="Continue" disabled={text.trim() === ''} onPress={next} />;
  }

  return (
    <Sheet
      visible={p.visible}
      title="Transfer tickets"
      onClose={close}
      closeDisabled={busy}
      onDismissed={p.onDismissed}
      footer={footer}
      scroll
      testID="transfer-sheet"
    >
      {body}
    </Sheet>
  );
}
