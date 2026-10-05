import { Linking } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { WEB_URL } from '@/shared/config/store';
import { Button, Screen, Stack, Text } from '@/shared/ui';

export default function WebOnly() {
  const signOut = useAuth((s) => s.signOut);
  return (
    <Screen>
      <Stack gap="s3">
        <Text variant="titleLg">Use the web dashboard</Text>
        <Text variant="body" tone="textSecondary">
          Vendor, admin and support accounts are managed on bookhushly.com.
        </Text>
      </Stack>
      <Stack gap="s3">
        <Button
          label="Open bookhushly.com"
          onPress={() => {
            void Linking.openURL(WEB_URL);
          }}
        />
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
