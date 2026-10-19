import { useEffect, useState, type ReactNode } from 'react';

import { CLAIM_RESEND_SEC, type ClaimState } from '@/features/customer/hooks/useClaim';
import { bookingsWord, CONFIRM_EMAIL } from '@/features/customer/ui/ClaimCard';
import { mmss } from '@/features/customer/ui/RateLimitWait';
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
  /** The hook's resend time, kept across closing the sheet (Task 4 review, parked item 2). */
  resendAt: number | null;
  onSend: () => Promise<void>;
  onVerify: (code: string) => Promise<void>;
  /** Back to idle; the sheet hides. */
  onClose: () => void;
};

const CODE_LENGTH = 6;
const WRONG_CODE = 'That code is wrong or has expired';
const TRY_AGAIN = 'Something went wrong. Try again.';

type Failure = Extract<ClaimState, { kind: 'error' }>['outcome'];

function secondsLeft(untilMs: number | null, nowMs: number): number {
  return untilMs === null ? 0 : Math.max(0, Math.ceil((untilMs - nowMs) / 1000));
}

// Spec E4: refusals in words; transient failures and rate limits stay neutral.
function failureText(o: Failure, step: 'send' | 'verify'): string {
  switch (o.kind) {
    case 'rateLimited':
      // A fixed line: the seconds tick beside the banner, never inside it (UX review U1).
      return 'Too many tries.';
    case 'signedOut':
      return 'Sign in again to add these bookings.';
    case 'uncertain':
      return step === 'send' ? 'We couldn’t send the code. Try again.' : TRY_AGAIN;
    case 'refused':
      if (o.reason === 'invalidCode') return WRONG_CODE;
      if (o.reason === 'emailUnverified') return CONFIRM_EMAIL;
      if (o.reason === 'notCustomer') return 'Only customer accounts can add guest bookings.';
      return TRY_AGAIN;
  }
}

function isWrongCode(s: ClaimState): boolean {
  return s.kind === 'error' && s.outcome.kind === 'refused' && s.outcome.reason === 'invalidCode';
}

// Spec E4 / §3: one sheet, three steps — send a code, enter it, the result.
export function ClaimSheet({
  visible,
  email,
  state,
  resendAt: kept,
  onSend,
  onVerify,
  onClose,
}: Props) {
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
  const resendAt =
    state.kind === 'codeSent'
      ? state.resendAt
      : failure !== null
        ? failure.resendAt
        : state.kind === 'idle'
          ? kept
          : null;
  const resendLeft = secondsLeft(resendAt, nowMs);
  const verifyLimited =
    failure?.step === 'verify' && failure.outcome.kind === 'rateLimited'
      ? secondsLeft(verifiedAt + (failure.outcome.retryAfterSec ?? CLAIM_RESEND_SEC) * 1000, nowMs)
      : 0;
  const ticking = visible && (resendLeft > 0 || verifyLimited > 0);

  useEffect(() => {
    if (!ticking) return;
    // Reopened later: catch the clock up at once rather than on the first tick.
    const now = setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => {
      clearTimeout(now);
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
    failure !== null && !isWrongCode(state) ? failureText(failure.outcome, failure.step) : null;
  // The rate-limit seconds: plain, non-live text beside the fixed banner (UX review U1).
  const waitSec =
    failure?.outcome.kind === 'rateLimited'
      ? failure.step === 'send'
        ? resendLeft
        : verifyLimited
      : null;
  const notice =
    failureLine === null ? null : (
      <Stack gap="s2">
        <Banner tone="neutral" message={failureLine} testID="claim-notice" />
        {waitSec !== null ? (
          <Text variant="bodySm" tone="textSecondary" tabular testID="claim-wait">
            {waitSec > 0 ? `You can try again in ${mmss(waitSec)}` : 'You can try again now.'}
          </Text>
        ) : null}
      </Stack>
    );

  let body: ReactNode;
  let footer: ReactNode;
  if (step === 'done' && state.kind === 'done') {
    body = (
      <Stack gap="s4">
        <SuccessMark size={64} animate />
        <Text variant="titleLg" accessibilityRole="header" accessibilityLiveRegion="polite">
          {state.total === null
            ? 'Added your bookings'
            : state.total > 0
              ? `Added ${bookingsWord(state.total)}`
              : 'These bookings are already in your account'}
        </Text>
        <Text variant="body" tone="textSecondary">
          {state.total === 0 ? 'There was nothing new to add.' : 'They’re now in your bookings.'}
        </Text>
      </Stack>
    );
    footer = <Button label="Done" onPress={close} />;
  } else if (step === 'code') {
    body = (
      <Stack gap="s4">
        <Stack gap="s2">
          <Text variant="titleLg" accessibilityRole="header">
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
        {notice}
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
        <Inline justify="center">
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
        </Inline>
      </Stack>
    );
  } else {
    body = (
      <Stack gap="s4">
        <Text variant="body" tone="textSecondary">
          We’ll email a 6-digit code to {maskEmail(email)}. Enter it here and the bookings you made
          as a guest with this email are added to your account.
        </Text>
        {notice}
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
