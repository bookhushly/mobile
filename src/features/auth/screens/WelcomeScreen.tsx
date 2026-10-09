import { View } from 'react-native';

import type { AuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { PRIVACY_URL, TERMS_URL } from '@/shared/config/store';
import { space } from '@/shared/theme';
import { Banner, Button, Illustration, Screen, Stack, Text, TextLink } from '@/shared/ui';

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
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              columnGap: space.s1,
            }}
          >
            <Text variant="caption" tone="textSecondary">
              By continuing you agree to our
            </Text>
            <TextLink
              label="Terms"
              onPress={() => {
                onOpenLink(TERMS_URL);
              }}
            />
            <Text variant="caption" tone="textSecondary">
              and
            </Text>
            <TextLink
              label="Privacy policy"
              onPress={() => {
                onOpenLink(PRIVACY_URL);
              }}
            />
          </View>
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
