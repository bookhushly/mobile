import { Download } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Button, ErrorState, Icon, Screen, Stack, Text } from '@/shared/ui';

// Pre-mode screens (spec §3): each one names what happened and always offers a next step.

const STORE_NAME = { ios: 'App Store', android: 'Play Store' } as const;

type UpdateRequiredProps = {
  storeUrl: string;
  platform: 'ios' | 'android';
  onOpen: (url: string) => void;
};

export function UpdateRequiredScreen({ storeUrl, platform, onOpen }: UpdateRequiredProps) {
  return (
    <Screen
      footer={
        storeUrl !== '' ? (
          <Button
            label="Update"
            onPress={() => {
              onOpen(storeUrl);
            }}
          />
        ) : undefined
      }
    >
      <View style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s8 }}>
        <Icon as={Download} size="lg" tone="textSecondary" />
        <Text variant="headline" align="center" accessibilityRole="header">
          Update Bookhushly
        </Text>
        <Text variant="body" tone="textSecondary" align="center">
          This version is no longer supported.
        </Text>
        {storeUrl === '' ? (
          <Text variant="body" align="center">
            {`Update Bookhushly from the ${STORE_NAME[platform]}`}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

type ModeErrorProps = { onRetry: () => void; onSignOut: () => void };

export function ModeErrorScreen({ onRetry, onSignOut }: ModeErrorProps) {
  return (
    <Screen footer={<Button label="Sign out" variant="secondary" onPress={onSignOut} />}>
      <ErrorState
        title="We couldn't load your account"
        message="Check your connection and try again."
        onRetry={onRetry}
      />
    </Screen>
  );
}

type WebOnlyProps = { email: string; onOpenWeb: () => void; onSignOut: () => void };

export function WebOnlyScreen({ email, onOpenWeb, onSignOut }: WebOnlyProps) {
  return (
    <Screen
      footer={
        <>
          <Button label="Open bookhushly.com" onPress={onOpenWeb} />
          <Button label="Sign out" variant="secondary" onPress={onSignOut} />
        </>
      }
    >
      <Stack gap="s1">
        <Text variant="caption" tone="textSecondary">
          Signed in as
        </Text>
        <Text variant="bodyStrong">{email}</Text>
      </Stack>
      <Stack gap="s3">
        <Text variant="titleLg" accessibilityRole="header">
          Use the web dashboard
        </Text>
        <Text variant="body" tone="textSecondary">
          Vendor, admin and support accounts are managed on bookhushly.com. The app is for
          customers, gate staff and front desk.
        </Text>
      </Stack>
    </Screen>
  );
}
