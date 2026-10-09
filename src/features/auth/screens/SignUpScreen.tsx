import { useRef, useState } from 'react';
import { View } from 'react-native';

import type { AccountFailure } from '@/features/auth/api/accountApi';
import { passwordRules, RULES } from '@/features/auth/domain/passwordRules';
import type { FieldErrors } from '@/features/auth/domain/signUpErrors';
import { signUpSchema, type SignUpInput } from '@/features/auth/schemas/signUp';
import { PRIVACY_URL, TERMS_URL } from '@/shared/config/store';
import type { Result } from '@/shared/lib/result';
import { space } from '@/shared/theme';
import {
  Banner,
  Button,
  Input,
  PasswordField,
  RuleList,
  Screen,
  Stack,
  Text,
  TextLink,
} from '@/shared/ui';

type Props = {
  onSubmit: (input: SignUpInput) => Promise<Result<{ email: string }, AccountFailure>>;
  /** Account created: continue to the code screen with the server's normalised email. */
  onVerified: (email: string) => void;
  /** `email_taken`: the route resends the confirmation code and opens the code screen. */
  onVerifyExisting: (email: string) => Promise<void>;
  onSignIn: () => void;
  onOpenLink: (url: string) => void;
};

// `emailTaken` is ambiguous (confirmed or not), so both paths are offered (spec §2 decision 8).
type Notice = { kind: 'emailTaken'; email: string } | { kind: 'neutral'; message: string };

const TOO_LONG_MESSAGE = 'That password is too long';
const FAILED_MESSAGE = 'We couldn’t create your account. Try again.';
const INVALID_MESSAGE = 'Check your details and try again.';

function transientMessage(retryAfterSec: number | undefined): string {
  const when = retryAfterSec === undefined ? 'a minute' : `${String(retryAfterSec)} seconds`;
  return `We couldn’t reach Bookhushly — try again in ${when}`;
}

function hasFieldErrors(fields: FieldErrors): boolean {
  return fields.name !== undefined || fields.email !== undefined || fields.password !== undefined;
}

export function SignUpScreen({ onSubmit, onVerified, onVerifyExisting, onSignIn, onOpenLink }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Single-flight: `submitting` lags a render behind a double tap, the ref does not.
  const inFlight = useRef(false);

  const rules = passwordRules(password);
  const parsed = signUpSchema.safeParse({ name, email, password });
  const canSubmit = parsed.success && rules.ok;

  async function submit() {
    if (inFlight.current || !parsed.success || !rules.ok) return;
    inFlight.current = true;
    setSubmitting(true);
    // Each attempt starts clean so nothing from the last one outlives a retry.
    setFieldErrors({});
    setNotice(null);
    try {
      const r = await onSubmit(parsed.data);
      if (r.ok) {
        onVerified(r.value.email);
        return;
      }
      const e = r.error;
      switch (e.kind) {
        case 'invalid':
        case 'weakPassword':
          // A 400 can arrive without `fields` (contract): say something rather than nothing.
          if (hasFieldErrors(e.fields)) setFieldErrors(e.fields);
          else setNotice({ kind: 'neutral', message: INVALID_MESSAGE });
          break;
        case 'emailTaken':
          setNotice({ kind: 'emailTaken', email: parsed.data.email });
          break;
        case 'transient':
          setNotice({ kind: 'neutral', message: transientMessage(e.retryAfterSec) });
          break;
        case 'failed':
        case 'unauthorized':
        case 'notCustomer':
        case 'blocked':
          // The last three cannot come from signup; the message still says what to do.
          setNotice({ kind: 'neutral', message: FAILED_MESSAGE });
      }
    } catch {
      setNotice({ kind: 'neutral', message: FAILED_MESSAGE });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function verifyExisting(taken: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setVerifying(true);
    try {
      await onVerifyExisting(taken);
    } catch {
      setNotice({ kind: 'neutral', message: transientMessage(undefined) });
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  }

  return (
    <Screen
      scroll
      footer={
        <>
          <View style={{ alignItems: 'center' }}>
            <TextLink label="Already have an account? Sign in" onPress={onSignIn} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              columnGap: space.s1,
            }}
          >
            <Text variant="caption" tone="textSecondary">
              By continuing you agree to our
            </Text>
            <TextLink
              label="Terms"
              onPress={() => {
                onOpenLink(TERMS_URL);
              }}
            />
            <Text variant="caption" tone="textSecondary">
              and
            </Text>
            <TextLink
              label="Privacy policy"
              onPress={() => {
                onOpenLink(PRIVACY_URL);
              }}
            />
          </View>
        </>
      }
    >
      <Stack gap="s3">
        <Text variant="displaySm" accessibilityRole="header">
          Create your account
        </Text>
        <Text variant="body" tone="textSecondary">
          Book stays and events, paid in naira.
        </Text>
      </Stack>
      <Stack gap="s4">
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          error={fieldErrors.name}
          returnKeyType="next"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
        />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          returnKeyType="next"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Stack gap="s3">
          <PasswordField
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            returnKeyType="go"
            onSubmitEditing={() => {
              void submit();
            }}
            autoComplete="new-password"
            textContentType="newPassword"
          />
          {rules.tooLong ? (
            <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
              {TOO_LONG_MESSAGE}
            </Text>
          ) : null}
          <RuleList
            rules={RULES.map((r) => ({ id: r.id, label: r.label, met: rules.met[r.id] }))}
            touched={password.length > 0}
          />
        </Stack>
        {notice?.kind === 'neutral' ? (
          <Banner tone="neutral" message={notice.message} live="polite" />
        ) : null}
        {notice?.kind === 'emailTaken' ? (
          <Stack gap="s3">
            <Banner tone="info" message="This email already has an account." live="polite" />
            <Button label="Sign in instead" variant="secondary" onPress={onSignIn} />
            <Button
              label="Verify this email"
              variant="secondary"
              loading={verifying}
              onPress={() => {
                void verifyExisting(notice.email);
              }}
            />
          </Stack>
        ) : null}
        <Button
          label="Create account"
          disabled={!canSubmit}
          loading={submitting}
          onPress={() => {
            void submit();
          }}
        />
      </Stack>
    </Screen>
  );
}
