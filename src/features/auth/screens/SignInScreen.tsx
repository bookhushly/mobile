import { useState } from 'react';
import { Linking, Pressable } from 'react-native';

import { signInCopy, type SignInError } from '@/features/auth/domain/signInErrors';
import { signInSchema } from '@/features/auth/schemas/signIn';
import { density, type StatusTone } from '@/shared/theme';
import { Banner, Button, Input, Screen, Stack, Text } from '@/shared/ui';

type Props = {
  onSubmit: (email: string, password: string) => Promise<SignInError | null>;
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

export function SignInScreen({ onSubmit }: Props) {
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
    setSubmitting(true);
    try {
      const failure = await onSubmit(parsed.data.email, parsed.data.password);
      setError(failure ? shownError(failure) : null);
    } catch {
      setError(shownError('unknown'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
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
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry
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
      </Stack>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="New to Bookhushly? Create your account on bookhushly.com."
        hitSlop={8}
        style={{ minHeight: density.customer.controlHeight, justifyContent: 'center' }}
        onPress={() => {
          void Linking.openURL('https://www.bookhushly.com');
        }}
      >
        <Text variant="bodySm" tone="linkText">
          New to Bookhushly? Create your account on bookhushly.com.
        </Text>
      </Pressable>
    </Screen>
  );
}
