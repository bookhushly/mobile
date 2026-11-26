import { BadgeCheck, ExternalLink, Mail, Repeat } from 'lucide-react-native';
import { View } from 'react-native';

import type { AccountLink } from '@/features/vendor/domain/accountLinks';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Button, Icon, ListRow, Screen, Text } from '@/shared/ui';

type Props = {
  businessName: string;
  kindWord: string;
  email: string;
  links: AccountLink[];
  onOpenLink: (l: AccountLink) => void;
  onEmailSupport: () => void;
  /** Null when the account has no customer mode to switch to. */
  onSwitchToBooking: (() => void) | null;
  onSignOut: () => void;
};

/**
 * Account (design v13): the business, then the settings that live on the web (each opens its own
 * page), then switching to booking and signing out.
 */
export function AccountScreen({
  businessName,
  kindWord,
  email,
  links,
  onOpenLink,
  onEmailSupport,
  onSwitchToBooking,
  onSignOut,
}: Props) {
  return (
    <Screen scroll>
      <View style={{ gap: space.s6, paddingTop: space.s5, paddingBottom: space.s8 }}>
        <Text variant="titleLg" accessibilityRole="header">
          Account
        </Text>

        <View
          style={{
            backgroundColor: color.wash,
            borderRadius: radius.r4,
            padding: space.s5,
            gap: space.s3,
          }}
        >
          <View style={{ gap: space.s1 }}>
            <Text variant="headline">{businessName}</Text>
            <Text variant="caption" tone="textSecondary">
              {kindWord}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: space.s2,
              backgroundColor: color.surface,
              borderWidth: borderWidth.hairline,
              borderColor: color.border,
              borderRadius: radius.rFull,
              paddingVertical: space.s1,
              paddingHorizontal: space.s3,
            }}
          >
            <Icon as={BadgeCheck} size="xs" />
            <Text variant="labelSm">Approved</Text>
          </View>
        </View>

        {onSwitchToBooking === null ? null : (
          <Button
            label="Switch to booking"
            icon={Repeat}
            variant="secondary"
            onPress={onSwitchToBooking}
            testID="vendor-switch-booking"
          />
        )}

        <View>
          <Text variant="labelSm" tone="textSecondary" accessibilityRole="header">
            On bookhushly.com
          </Text>
          {links.map((l) => (
            <ListRow
              key={l.title}
              title={l.title}
              subtitle={l.detail}
              accessibilityLabel={`${l.title}, ${l.detail}. Opens bookhushly.com`}
              trailing={<Icon as={ExternalLink} size="sm" tone="textMuted" />}
              onPress={() => {
                onOpenLink(l);
              }}
            />
          ))}
          <ListRow
            title="Email support"
            subtitle="support@bookhushly.com"
            trailing={<Icon as={Mail} size="sm" tone="textMuted" />}
            onPress={onEmailSupport}
          />
        </View>

        <View style={{ gap: space.s3 }}>
          <View style={{ gap: space.s1 }}>
            <Text variant="caption" tone="textSecondary">
              Signed in as
            </Text>
            <Text variant="label">{email}</Text>
          </View>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={onSignOut}
            testID="vendor-sign-out"
          />
        </View>
      </View>
    </Screen>
  );
}
