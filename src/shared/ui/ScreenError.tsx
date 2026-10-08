import { useEffect } from 'react';

import { captureException } from '@/shared/monitoring';

import { Button } from './Button';
import { Screen } from './Screen';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = { error: Error; retry: () => void };

// Used as an Expo Router ErrorBoundary. Never prints the raw error to the user.
export function ScreenError({ error, retry }: Props) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <Screen>
      <Stack gap="s3">
        <Text variant="titleLg">Something went wrong</Text>
        <Text variant="body" tone="textSecondary">
          Something didn&apos;t load. Try again, or restart the app if it keeps happening.
        </Text>
      </Stack>
      <Button label="Try again" onPress={retry} />
    </Screen>
  );
}
