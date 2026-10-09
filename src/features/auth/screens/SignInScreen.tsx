import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { signInCopy, type SignInError } from '@/features/auth/domain/signInErrors';
import { signInSchema } from '@/features/auth/schemas/signIn';
import { type StatusTone } from '@/shared/theme';
import {
  Banner,
  Button,
  IconButton,
  Input,
  PasswordField,
  Screen,
  Stack,
  Text,
  TextLink,
} from '@/shared/ui';

type Props = {
  onSubmit: (email: string, password: string) => Promise<SignInError | null>;
  /** Hands the typed (normalised) email to the forgot-password flow. */
  onForgot: (email: string) => void;
  onCreateAccount: () => void;
  /** Unconfirmed email: the route resends the code and moves to the code screen. */
  onConfirmEmail: (email: string) => Promise<void>;
  /** Back to Welcome; the header button is hidden when absent (bare unit renders). */
  onBack?: () => void;
};

type FieldErrors = { email?: string; password?: string };
type ShownError = { kind: SignInError; tone: StatusTone };

// Transient failures (network, rate limit, our side) are never red: the user did nothing wrong.
const TRANSIENT: ReadonlySet<SignInError> = new Set([
  'network',
  'rateLimited',
  'unavailable',
  'unknown',
]);

function shownError(kind: SignInError): ShownError {
  return { kind, tone: TRANSIENT.has(kind) ? 'neutral' : 'danger' };
}

export function SignInScreen({
  onSubmit,
  onForgot,
  onCreateAccount,
  onConfirmEmail,
  onBack,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ShownError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'email') next.email = issue.message;
        if (field === 'password') next.password = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    // Each attempt starts clean so a stale banner never outlives a retry; `current` in the catch
    // below can then only be this attempt's own error.
    setError(null);
    setSubmitting(true);
    try {
      const failure = await onSubmit(parsed.data.email, parsed.data.password);
      setError(failure ? shownError(failure) : null);
      // The banner stays visible as the handoff happens, and remains if the handoff fails.
      if (failure === 'emailNotConfirmed') await onConfirmEmail(parsed.data.email);
    } catch {
      setError((current) => current ?? shownError('unknown'));
    } finally {
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
      footer={
        <View style={{ alignItems: 'center' }}>
          <TextLink label="New here? Create account" onPress={onCreateAccount} />
        </View>
      }
    >
      <Stack gap="s3">
        <Text variant="displaySm" accessibilityRole="header">
          Welcome back
        </Text>
        <Text variant="body" tone="textSecondary">
          Sign in to your Bookhushly account.
        </Text>
      </Stack>
      <Stack gap="s4">
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          returnKeyType="next"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
        />
        <PasswordField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          returnKeyType="go"
          onSubmitEditing={() => {
            void submit();
          }}
          autoComplete="password"
          textContentType="password"
        />
        {error ? <Banner tone={error.tone} message={signInCopy[error.kind]} live="polite" /> : null}
        <Button
          label="Sign in"
          loading={submitting}
          onPress={() => {
            void submit();
          }}
        />
        <View style={{ alignItems: 'flex-start' }}>
          <TextLink
            label="Forgot password?"
            onPress={() => {
              onForgot(email.trim().toLowerCase());
            }}
          />
        </View>
      </Stack>
    </Screen>
  );
}
