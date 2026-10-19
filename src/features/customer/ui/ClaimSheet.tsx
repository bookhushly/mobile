import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { CLAIM_RESEND_SEC, type ClaimState } from '@/features/customer/hooks/useClaim';
import { bookingsWord } from '@/features/customer/ui/ClaimCard';
import { maskEmail } from '@/shared/lib/maskEmail';
import {
  Banner,
  Button,
  CodeField,
  Inline,
  Sheet,
  Spinner,
  Stack,
  SuccessMark,
  Text,
  TextLink,
} from '@/shared/ui';

type Props = {
  visible: boolean;
  /** The account email (shown masked). */
  email: string;
  state: ClaimState;
  onSend: () => Promise<void>;
  onVerify: (code: string) => Promise<void>;
  /** Back to idle; the sheet hides. */
  onClose: () => void;
};

const CODE_LENGTH = 6;
const WRONG_CODE = 'That code is wrong or has expired';
const TRY_AGAIN = 'Something went wrong. Try again.';

type Failure = Extract<ClaimState, { kind: 'error' }>['outcome'];

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m)}:${s < 10 ? '0' : ''}${String(s)}`;
}

function secondsLeft(untilMs: number | null, nowMs: number): number {
  return untilMs === null ? 0 : Math.max(0, Math.ceil((untilMs - nowMs) / 1000));
}

// Spec E4: refusals in words; transient failures and rate limits stay neutral.
function failureText(o: Failure, step: 'send' | 'verify', waitSec: number): string {
  switch (o.kind) {
    case 'rateLimited':
      return waitSec > 0
        ? `Too many tries. You can try again in ${mmss(waitSec)}.`
        : 'You can try again now.';
    case 'signedOut':
      return 'Sign in again to add these bookings.';
    case 'uncertain':
      return step === 'send' ? 'We couldn’t send the code. Try again.' : TRY_AGAIN;
    case 'refused':
      if (o.reason === 'invalidCode') return WRONG_CODE;
      if (o.reason === 'emailUnverified') return 'Confirm your email first, then try again.';
      if (o.reason === 'notCustomer') return 'Only customer accounts can add guest bookings.';
      return TRY_AGAIN;
  }
}

function isWrongCode(s: ClaimState): boolean {
  return s.kind === 'error' && s.outcome.kind === 'refused' && s.outcome.reason === 'invalidCode';
}

// Spec E4 / §3: one sheet, three steps — send a code, enter it, the result.
export function ClaimSheet({ visible, email, state, onSend, onVerify, onClose }: Props) {
  const [code, setCode] = useState('');
  // A resend from the code step stays on the code step, whatever it answers.
  const [onCodeStep, setOnCodeStep] = useState(false);
  // When the last verify was sent, for the verify rate-limit countdown.
  const [verifiedAt, setVerifiedAt] = useState(0);
  // The tick lives in state, set from handlers and the interval, never read from a clock in render.
  const [nowMs, setNowMs] = useState(0);
  // A wrong code clears the boxes (adjusting state on a new answer, not in an effect).
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (isWrongCode(state)) setCode('');
    if (state.kind === 'codeSent') {
      // A new code replaces the old one.
      setCode('');
      setOnCodeStep(true);
    }
  }

  const busy = state.kind === 'sending' || state.kind === 'verifying';
  const failure = state.kind === 'error' ? state : null;
  const resendAt = state.kind === 'codeSent' ? state.resendAt : (failure?.resendAt ?? null);
  const resendLeft = secondsLeft(resendAt, nowMs);
  const verifyLimited =
    failure?.step === 'verify' && failure.outcome.kind === 'rateLimited'
      ? secondsLeft(verifiedAt + (failure.outcome.retryAfterSec ?? CLAIM_RESEND_SEC) * 1000, nowMs)
      : 0;
  const ticking = visible && (resendLeft > 0 || verifyLimited > 0);

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => {
      clearInterval(id);
    };
  }, [ticking]);

  const step: 'send' | 'code' | 'done' =
    state.kind === 'done'
      ? 'done'
      : state.kind === 'codeSent' ||
          state.kind === 'verifying' ||
          failure?.step === 'verify' ||
          onCodeStep
        ? 'code'
        : 'send';

  async function send() {
    if (busy || resendLeft > 0) return;
    setNowMs(Date.now());
    await onSend();
    setNowMs(Date.now());
  }

  async function verify(next: string) {
    if (busy || verifyLimited > 0 || next.length !== CODE_LENGTH) return;
    const at = Date.now();
    setVerifiedAt(at);
    setNowMs(at);
    await onVerify(next);
    setNowMs(Date.now());
  }

  function changeCode(next: string) {
    if (next === code) return;
    setCode(next);
    if (next.length === CODE_LENGTH) void verify(next);
  }

  function close() {
    if (busy) return;
    setCode('');
    setOnCodeStep(false);
    onClose();
  }

  const failureLine =
    failure !== null && !isWrongCode(state)
      ? failureText(
          failure.outcome,
          failure.step,
          failure.step === 'send' ? resendLeft : verifyLimited,
        )
      : null;

  let body: ReactNode;
  let footer: ReactNode;
  if (step === 'done' && state.kind === 'done') {
    body = (
      <Stack gap="s4">
        <SuccessMark size={64} animate />
        <Text variant="displaySm" accessibilityRole="header" accessibilityLiveRegion="polite">
          {state.total > 0
            ? `Added ${bookingsWord(state.total)}`
            : 'These bookings are already in your account'}
        </Text>
        <Text variant="body" tone="textSecondary">
          {state.total > 0 ? 'They’re now in your bookings.' : 'There was nothing new to add.'}
        </Text>
      </Stack>
    );
    footer = <Button label="Done" onPress={close} />;
  } else if (step === 'code') {
    body = (
      <Stack gap="s4">
        <Stack gap="s2">
          <Text variant="displaySm" accessibilityRole="header">
            Enter the 6-digit code
          </Text>
          <Text variant="body" tone="textSecondary">
            Sent to {maskEmail(email)}
          </Text>
        </Stack>
        <CodeField
          label="Code"
          value={code}
          onChangeText={changeCode}
          length={CODE_LENGTH}
          error={isWrongCode(state) ? WRONG_CODE : undefined}
          autoFocus
          testID="claim-code"
        />
        {state.kind === 'verifying' ? (
          <Inline gap="s2">
            <Spinner tone="textSecondary" />
            <Text variant="bodySm" tone="textSecondary" accessibilityLiveRegion="polite">
              Adding your bookings…
            </Text>
          </Inline>
        ) : null}
        {failureLine !== null ? (
          <Banner tone="neutral" message={failureLine} testID="claim-notice" />
        ) : null}
        <Text variant="caption" tone="textSecondary">
          Check spam or junk if it hasn’t arrived.
        </Text>
      </Stack>
    );
    footer = (
      <Stack gap="s3">
        <Button
          label="Add bookings"
          disabled={code.length !== CODE_LENGTH || verifyLimited > 0 || busy}
          loading={state.kind === 'verifying'}
          onPress={() => {
            void verify(code);
          }}
        />
        <View style={{ alignItems: 'center' }}>
          {resendLeft > 0 ? (
            <Text variant="bodySm" tone="textSecondary" tabular>
              Send a new code in {mmss(resendLeft)}
            </Text>
          ) : (
            <TextLink
              label={state.kind === 'sending' ? 'Sending…' : 'Send a new code'}
              onPress={() => {
                void send();
              }}
            />
          )}
        </View>
      </Stack>
    );
  } else {
    body = (
      <Stack gap="s4">
        <Text variant="displaySm" accessibilityRole="header">
          Add bookings made as a guest
        </Text>
        <Text variant="body" tone="textSecondary">
          We’ll email a 6-digit code to {maskEmail(email)}. Enter it here and the bookings you made
          as a guest with this email are added to your account.
        </Text>
        {failureLine !== null ? (
          <Banner tone="neutral" message={failureLine} testID="claim-notice" />
        ) : null}
      </Stack>
    );
    footer = (
      <Button
        label={resendLeft > 0 ? `Send code in ${mmss(resendLeft)}` : 'Send code'}
        disabled={resendLeft > 0}
        loading={state.kind === 'sending'}
        onPress={() => {
          void send();
        }}
      />
    );
  }

  return (
    <Sheet
      visible={visible}
      title="Guest bookings"
      onClose={close}
      closeDisabled={busy}
      footer={footer}
      scroll
      testID="claim-sheet"
    >
      {body}
    </Sheet>
  );
}
