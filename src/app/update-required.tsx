import { Linking } from 'react-native';

import { storeUrl } from '@/shared/config/store';
import { Button, Screen, Stack, Text } from '@/shared/ui';

export default function UpdateRequired() {
  return (
    <Screen>
      <Stack gap="s3">
        <Text variant="titleLg">Update Bookhushly</Text>
        <Text variant="body" tone="textSecondary">
          This version is no longer supported. Update the app to continue.
        </Text>
      </Stack>
      {storeUrl() ? (
        <Button
          label="Update the app"
          onPress={() => {
            void Linking.openURL(storeUrl());
          }}
        />
      ) : null}
    </Screen>
  );
}
