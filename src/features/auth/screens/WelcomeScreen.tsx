import { View } from 'react-native';

import { TermsLine } from '@/features/auth/components/TermsLine';
import type { AuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { space } from '@/shared/theme';
import { Banner, Button, Illustration, Screen, Stack, Text } from '@/shared/ui';

type Props = {
  notice: AuthNotice;
  onDismissNotice: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onOpenLink: (url: string) => void;
};

// Landing screen whenever signed out: create account first, sign in second (spec §2 decision 1).
export function WelcomeScreen({
  notice,
  onDismissNotice,
  onCreateAccount,
  onSignIn,
  onOpenLink,
}: Props) {
  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Create account" onPress={onCreateAccount} />
          <Button label="Sign in" variant="secondary" onPress={onSignIn} />
          <TermsLine onOpenLink={onOpenLink} />
        </>
      }
    >
      <Text variant="titleLg" accessibilityRole="header">
        Bookhushly
      </Text>
      {notice === 'accountDeleted' ? (
        <Banner
          tone="info"
          message="Your account was deleted."
          action={{ label: 'OK', onPress: onDismissNotice }}
        />
      ) : null}
      <View style={{ alignItems: 'center', paddingVertical: space.s5 }}>
        <Illustration name="welcome" size={200} />
      </View>
      <Stack gap="s3">
        <Text variant="display">Book stays and events across Nigeria</Text>
        <Text variant="body" tone="textSecondary">
          Hotels, apartments and event tickets, paid in naira, in one app.
        </Text>
      </Stack>
    </Screen>
  );
}
