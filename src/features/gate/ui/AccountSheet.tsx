import { UserRound } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { space } from '@/shared/theme';
import { Button, Card, Icon, Sheet, Stack, Text, TextLink } from '@/shared/ui';

type Props = {
  visible: boolean;
  email: string;
  /** The route passes <ModeSwitcher/>: gate code must not import the mode feature. */
  modeSwitcher: ReactNode;
  onSignOut: () => void;
  /** Called once the sheet is out of the way (iOS waits for the Modal to dismiss). */
  onDeleteAccount: () => void;
  onClose: () => void;
};

// FR-1.9: whose session is active on a shared phone, plus mode switch, sign-out and deletion.
export function AccountSheet({
  visible,
  email,
  modeSwitcher,
  onSignOut,
  onDeleteAccount,
  onClose,
}: Props) {
  // iOS can swallow a push made in the same tick as closing the RN Modal: push after dismissal.
  const [deleteAfterDismiss, setDeleteAfterDismiss] = useState(false);
  return (
    <Sheet
      visible={visible}
      title="Account"
      onClose={onClose}
      onDismissed={() => {
        if (!deleteAfterDismiss) return;
        setDeleteAfterDismiss(false);
        onDeleteAccount();
      }}
      scroll
      testID="account-sheet"
      footer={<Button variant="secondary" label="Sign out" onPress={onSignOut} />}
    >
      <Stack gap="s5">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
            <Icon as={UserRound} size="lg" tone="textSecondary" />
            <Stack gap="s1" flex={1}>
              <Text variant="label" tone="textMuted">
                Signed in as
              </Text>
              <Text variant="bodyStrong" numberOfLines={1}>
                {email}
              </Text>
            </Stack>
          </View>
        </Card>
        {modeSwitcher}
        <View style={{ alignSelf: 'flex-start' }}>
          <TextLink
            label="Delete account"
            onPress={() => {
              if (Platform.OS === 'ios') {
                setDeleteAfterDismiss(true);
                onClose();
                return;
              }
              onClose();
              onDeleteAccount();
            }}
          />
        </View>
      </Stack>
    </Sheet>
  );
}
