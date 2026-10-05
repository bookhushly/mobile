import { useState } from 'react';
import { Linking, Pressable } from 'react-native';

import { signInCopy, type SignInError } from '@/features/auth/domain/signInErrors';
import { signInSchema } from '@/features/auth/schemas/signIn';
import { color, density } from '@/shared/theme';
import { Box, Button, Input, Screen, Stack, Text } from '@/shared/ui';

type Props = {
  onSubmit: (email: string, password: string) => Promise<SignInError | null>;
};

type FieldErrors = { email?: string; password?: string };

export function SignInScreen({ onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
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
      setError(failure ? signInCopy[failure] : null);
    } catch {
      setError(signInCopy.unknown);
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
        {error ? (
          <Box p="s4" rounded="r3" style={{ backgroundColor: color.status.danger.bg }}>
            <Text
              variant="bodySm"
              accessibilityLiveRegion="polite"
              style={{ color: color.status.danger.fg }}
            >
              {error}
            </Text>
          </Box>
        ) : null}
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
