import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import type { AccountFailure } from '@/features/auth/api/accountApi';
import type { VerifyError } from '@/features/auth/domain/verifyErrors';
import { cooldownLeft } from '@/shared/lib/cooldown';
import { maskEmail } from '@/shared/lib/maskEmail';
import type { Result } from '@/shared/lib/result';
import {
  Banner,
  Button,
  CodeField,
  Inline,
  Screen,
  Spinner,
  Stack,
  Text,
  TextLink,
} from '@/shared/ui';

export type CodePurpose = 'signup' | 'confirm' | 'recovery';

type Props = {
  purpose: CodePurpose;
  email: string;
  /** Injected clock; only read inside effects and handlers (React Compiler purity). */
  now: () => number;
  onVerify: (code: string) => Promise<VerifyError | null>;
  onResend: () => Promise<Result<true, AccountFailure>>;
  onChangeEmail: () => void;
  onVerified: () => void;
  /** iOS only: `message://` can be opened. Hidden otherwise. */
  canOpenMail: boolean;
  onOpenMail: () => void;
};

type Notice = { kind: 'neutral'; message: string } | { kind: 'sent' };
type Cooldown = { startedAt: number; seconds: number };

const CODE_LENGTH = 6;
const COOLDOWN_SEC = 60;
const MAX_WRONG = 5;

const TITLE: Record<CodePurpose, string> = {
  signup: 'Enter the 6-digit code',
  confirm: 'Confirm your email first',
  recovery: 'Enter your reset code',
};
const WRONG_MESSAGE = 'That code is wrong or has expired';
const TOO_MANY_MESSAGE = 'Too many tries. Send a new code.';
const UNKNOWN_MESSAGE = "We couldn't check that code. Try again.";

function transientMessage(retryAfterSec: number | undefined): string {
  const when = retryAfterSec === undefined ? 'a minute' : `${String(retryAfterSec)} seconds`;
  return `We couldn’t reach Bookhushly — try again in ${when}`;
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m)}:${s < 10 ? '0' : ''}${String(s)}`;
}

export function CodeScreen({
  purpose,
  email,
  now,
  onVerify,
  onResend,
  onChangeEmail,
  onVerified,
  canOpenMail,
  onOpenMail,
}: Props) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [fieldMessage, setFieldMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [wrongInARow, setWrongInARow] = useState(0);
  // The tick lives in state so the countdown is recomputed from it; `now()` is never read in render.
  const [nowMs, setNowMs] = useState(() => now());
  const [cooldown, setCooldown] = useState<Cooldown>(() => ({
    startedAt: now(),
    seconds: COOLDOWN_SEC,
  }));
  // Single-flight: state lags a render behind a second change event, the refs do not.
  const inFlight = useRef(false);
  const verified = useRef(false);

  const left = cooldownLeft(cooldown.startedAt, nowMs, cooldown.seconds);
  const waiting = left > 0;

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => {
      setNowMs(now());
    }, 1_000);
    return () => {
      clearInterval(id);
    };
  }, [waiting, now]);

  async function verify(next: string) {
    if (inFlight.current || verified.current) return;
    inFlight.current = true;
    setVerifying(true);
    setFieldMessage(null);
    setNotice(null);
    try {
      const failure = await onVerify(next);
      switch (failure) {
        case null:
          verified.current = true;
          onVerified();
          break;
        case 'badCode': {
          const n = wrongInARow + 1;
          setWrongInARow(n);
          setFieldMessage(n >= MAX_WRONG ? TOO_MANY_MESSAGE : WRONG_MESSAGE);
          setCode('');
          break;
        }
        case 'transient':
          setNotice({ kind: 'neutral', message: transientMessage(undefined) });
          break;
        case 'unknown':
          setNotice({ kind: 'neutral', message: UNKNOWN_MESSAGE });
      }
    } catch {
      // A thrown verify (supabase-js rejecting) is a transient failure, never a stuck spinner.
      setNotice({ kind: 'neutral', message: transientMessage(undefined) });
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  }

  function changeCode(next: string) {
    if (next === code) return;
    setCode(next);
    if (next.length === CODE_LENGTH) void verify(next);
  }

  async function resend() {
    if (inFlight.current || waiting) return;
    inFlight.current = true;
    setResending(true);
    setNotice(null);
    try {
      const r = await onResend();
      const at = now();
      if (r.ok) {
        // The new code invalidates the old one (contract §1.2): start the count again.
        setWrongInARow(0);
        setFieldMessage(null);
        setNotice({ kind: 'sent' });
        setCooldown({ startedAt: at, seconds: COOLDOWN_SEC });
        return;
      }
      const retry = r.error.kind === 'transient' ? r.error.retryAfterSec : undefined;
      setNotice({ kind: 'neutral', message: transientMessage(retry) });
      // The server's wait wins only when it is longer than what is left.
      const remaining = cooldownLeft(cooldown.startedAt, at, cooldown.seconds);
      if (retry !== undefined && retry > remaining) setCooldown({ startedAt: at, seconds: retry });
    } catch {
      setNotice({ kind: 'neutral', message: transientMessage(undefined) });
    } finally {
      inFlight.current = false;
      setResending(false);
    }
  }

  return (
    <Screen
      scroll
      footer={
        <Stack gap="s3">
          <Button
            label={waiting ? `Send a new code in ${mmss(left)}` : 'Send a new code'}
            variant="secondary"
            disabled={waiting}
            loading={resending}
            onPress={() => {
              void resend();
            }}
          />
          <View style={{ alignItems: 'center' }}>
            <Text variant="caption" tone="textSecondary" align="center">
              Check spam or junk if it hasn’t arrived.
            </Text>
            {canOpenMail ? <TextLink label="Open email app" onPress={onOpenMail} /> : null}
          </View>
        </Stack>
      }
    >
      <Stack gap="s3">
        <Text variant="displaySm" accessibilityRole="header">
          {TITLE[purpose]}
        </Text>
        <Inline gap="s1" style={{ flexWrap: 'wrap' }}>
          <Text variant="body" tone="textSecondary">
            Sent to {maskEmail(email)}
          </Text>
          <TextLink label="Change" onPress={onChangeEmail} />
        </Inline>
      </Stack>
      <Stack gap="s3">
        <CodeField
          label="Code"
          value={code}
          onChangeText={changeCode}
          length={CODE_LENGTH}
          autoFocus
        />
        {verifying ? (
          <Inline gap="s2">
            <Spinner tone="textSecondary" />
            <Text variant="bodySm" tone="textSecondary" accessibilityLiveRegion="polite">
              Verifying…
            </Text>
          </Inline>
        ) : null}
        {fieldMessage !== null ? (
          <Text variant="bodySm" tone="textSecondary" accessibilityLiveRegion="polite">
            {fieldMessage}
          </Text>
        ) : null}
        {notice?.kind === 'neutral' ? (
          <Banner tone="neutral" message={notice.message} live="polite" />
        ) : null}
        {notice?.kind === 'sent' ? (
          <Banner tone="success" message="We sent a new code." live="polite" testID="resent" />
        ) : null}
      </Stack>
    </Screen>
  );
}
