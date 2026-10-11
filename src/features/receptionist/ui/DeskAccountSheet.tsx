import { Building2, UserRound } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { space } from '@/shared/theme';
import { Button, Card, Icon, Sheet, Stack, Text, TextLink } from '@/shared/ui';

type Props = {
  visible: boolean;
  email: string;
  hotelName: string;
  /** Only staff at several hotels can switch (R7). */
  canChangeHotel: boolean;
  /** The route passes <ModeSwitcher/>: desk code must not import the mode feature. */
  modeSwitcher: ReactNode;
  onChangeHotel: () => void;
  /** Called once the sheet is out of the way (iOS waits for the Modal to dismiss). */
  onActivity: () => void;
  onSignOut: () => void;
  onClose: () => void;
};

// R12: hotel, who is signed in, mode switch, sign-out. No Delete account: receptionists can't
// delete (spec UI-B).
export function DeskAccountSheet({
  visible,
  email,
  hotelName,
  canChangeHotel,
  modeSwitcher,
  onChangeHotel,
  onActivity,
  onSignOut,
  onClose,
}: Props) {
  // iOS can swallow a push made in the same tick as closing the RN Modal: push after dismissal.
  const [activityAfterDismiss, setActivityAfterDismiss] = useState(false);
  return (
    <Sheet
      visible={visible}
      title="Account"
      onClose={onClose}
      onDismissed={() => {
        if (!activityAfterDismiss) return;
        setActivityAfterDismiss(false);
        onActivity();
      }}
      scroll
      testID="desk-account-sheet"
      footer={<Button variant="secondary" label="Sign out" onPress={onSignOut} />}
    >
      <Stack gap="s5">
        <Card>
          <Stack gap="s4">
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
              <Icon as={Building2} size="lg" tone="textSecondary" />
              <Stack gap="s1" flex={1}>
                <Text variant="label" tone="textMuted">
                  Front desk at
                </Text>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {hotelName}
                </Text>
              </Stack>
            </View>
            {canChangeHotel ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <TextLink
                  label="Change hotel"
                  onPress={() => {
                    onClose();
                    onChangeHotel();
                  }}
                />
              </View>
            ) : null}
          </Stack>
        </Card>
        <View style={{ alignSelf: 'flex-start' }}>
          <TextLink
            label="Shift activity"
            onPress={() => {
              if (Platform.OS === 'ios') {
                setActivityAfterDismiss(true);
                onClose();
                return;
              }
              onClose();
              onActivity();
            }}
          />
        </View>
        {modeSwitcher}
      </Stack>
    </Sheet>
  );
}
