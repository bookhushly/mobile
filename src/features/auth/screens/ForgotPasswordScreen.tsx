import { ArrowLeft } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import type { AccountFailure } from '@/features/auth/api/accountApi';
import { transientMessage } from '@/features/auth/domain/transientMessage';
import { forgotPasswordSchema } from '@/features/auth/schemas/forgotPassword';
import type { Result } from '@/shared/lib/result';
import { Banner, Button, IconButton, Input, Screen, Stack, Text } from '@/shared/ui';

type Props = {
  /** The address typed on sign-in, if any; the user can still change it. */
  initialEmail: string;
  onSubmit: (email: string) => Promise<Result<true, AccountFailure>>;
  /** Continue to the code screen with the normalised email. */
  onSent: (email: string) => void;
  /** Back to sign-in; the header button is hidden when absent (bare unit renders). */
  onBack?: () => void;
};

const HINT = 'If an account uses this email, we’ll send a 6-digit code.';

export function ForgotPasswordScreen({ initialEmail, onSubmit, onSent, onBack }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Single-flight: `submitting` lags a render behind a double tap, the ref does not.
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current) return;
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    // Each attempt starts clean so nothing from the last one outlives a retry.
    setFieldError(undefined);
    setNotice(null);
    try {
      const r = await onSubmit(parsed.data.email);
      // Only a malformed address or an unreachable server keeps the user here. Anything else
      // continues: the code screen offers resend and never leaks whether the account exists.
      if (!r.ok && r.error.kind === 'invalid') {
        setFieldError(r.error.fields.email ?? 'Enter a valid email address');
        return;
      }
      if (!r.ok && r.error.kind === 'transient') {
        setNotice(transientMessage(r.error.retryAfterSec));
        return;
      }
      onSent(parsed.data.email);
    } catch {
      setNotice(transientMessage(undefined));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen
      scroll
      header={
        onBack !== undefined ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
            <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />
          </View>
        ) : undefined
      }
    >
      <Stack gap="s3">
        <Text variant="displaySm" accessibilityRole="header">
          Reset your password
        </Text>
        <Text variant="body" tone="textSecondary">
          Enter your email and we’ll send a code to choose a new one.
        </Text>
      </Stack>
      <Stack gap="s4">
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={fieldError}
          hint={HINT}
          returnKeyType="go"
          onSubmitEditing={() => {
            void submit();
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        {notice !== null ? <Banner tone="neutral" message={notice} live="polite" /> : null}
        <Button
          label="Send code"
          loading={submitting}
          onPress={() => {
            void submit();
          }}
        />
      </Stack>
    </Screen>
  );
}
