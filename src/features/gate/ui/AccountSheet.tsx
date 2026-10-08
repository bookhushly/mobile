import { UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Button, Card, Icon, Sheet, Stack, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  email: string;
  /** The route passes <ModeSwitcher/>: gate code must not import the mode feature. */
  modeSwitcher: ReactNode;
  onSignOut: () => void;
  onClose: () => void;
};

// FR-1.9: whose session is active on a shared phone, plus mode switch and sign-out.
export function AccountSheet({ visible, email, modeSwitcher, onSignOut, onClose }: Props) {
  return (
    <Sheet
      visible={visible}
      title="Account"
      onClose={onClose}
      scroll
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
      </Stack>
    </Sheet>
  );
}
