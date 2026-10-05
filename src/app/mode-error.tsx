import { useAuth } from '@/features/auth/hooks/useAuth';
import { useModeState } from '@/features/mode/hooks/useModeState';
import { Button, Screen, Stack, Text } from '@/shared/ui';

export default function ModeError() {
  const auth = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const { retry } = useModeState(auth.status === 'signedIn' ? auth.userId : null);
  return (
    <Screen>
      <Stack gap="s3">
        <Text variant="titleLg">We couldn’t load your account</Text>
        <Text variant="body" tone="textSecondary">
          Check your connection and try again.
        </Text>
      </Stack>
      <Stack gap="s3">
        <Button label="Try again" onPress={retry} />
        <Button
          variant="secondary"
          label="Sign out"
          onPress={() => {
            void signOut();
          }}
        />
      </Stack>
    </Screen>
  );
}
