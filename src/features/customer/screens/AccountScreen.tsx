import {
  CircleHelp,
  ExternalLink,
  FileText,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useProfile, useSaveProfile } from '@/features/customer/hooks/useProfile';
import {
  ProfileFieldSheet,
  type ProfileField,
} from '@/features/customer/screens/ProfileFieldSheet';
import { initials } from '@/features/customer/ui/initials';
import { openWeb } from '@/features/customer/ui/links';
import { APP_VERSION } from '@/shared/api/instance';
import { HELP_URL, PRIVACY_URL, TERMS_URL } from '@/shared/config/store';
import { formatNigerianPhone } from '@/shared/lib/phone';
import { cardSize, color, elevation, radius, space } from '@/shared/theme';
import {
  Button,
  ErrorState,
  Header,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  SkeletonRows,
  Stack,
  Text,
  TextLink,
} from '@/shared/ui';

const AVATAR = cardSize.avatarLg;
const ADD = 'Not provided';

type Props = {
  userId: string;
  email: string;
  /** The mode switcher (renders nothing when the user has one mode). */
  modeSwitcher?: ReactNode;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

// Spec C14; Mobbin §6.
export function AccountScreen({ userId, email, modeSwitcher, onSignOut, onDeleteAccount }: Props) {
  const { profile, loading, refetch } = useProfile(userId);
  const { save, saving } = useSaveProfile(userId);
  // The field stays set while the sheet slides away; `opened` keys a fresh draft per open.
  const [field, setField] = useState<ProfileField | null>(null);
  const [opened, setOpened] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const edit = (f: ProfileField) => {
    setField(f);
    setOpened((n) => n + 1);
    setSheetOpen(true);
  };
  const name = profile?.name ?? '';
  const shown = profile?.email ?? email;

  let details: ReactNode;
  if (profile !== null) {
    const rows: { f: ProfileField; title: string; value: string | null }[] = [
      { f: 'name', title: 'Name', value: profile.name === '' ? null : profile.name },
      {
        f: 'phone',
        title: 'Phone',
        value: profile.phone === null ? null : formatNigerianPhone(profile.phone),
      },
      { f: 'state', title: 'State', value: profile.state },
      { f: 'address', title: 'Address', value: profile.address },
    ];
    details = rows.map((r) => (
      <ListRow
        key={r.f}
        title={r.title}
        subtitle={r.value ?? ADD}
        accessibilityLabel={`${r.title}, ${r.value ?? 'not set'}, ${r.value === null ? 'add' : 'edit'}`}
        onPress={() => {
          edit(r.f);
        }}
        // Airbnb's "Personal info": the value under its name and an underlined Edit or Add.
        trailing={
          <Text variant="label" style={{ textDecorationLine: 'underline' }}>
            {r.value === null ? 'Add' : 'Edit'}
          </Text>
        }
      />
    ));
  } else if (loading) {
    details = <SkeletonRows count={4} />;
  } else {
    details = (
      <ErrorState
        title="Couldn’t load your details"
        message="Check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const link = (title: string, url: string, icon: LucideIcon) => (
    <ListRow
      title={title}
      leading={<Icon as={icon} size="md" />}
      accessibilityLabel={`${title}, opens bookhushly.com`}
      onPress={() => {
        openWeb(url);
      }}
      trailing={<Icon as={ExternalLink} size="sm" tone="textSecondary" />}
    />
  );

  return (
    <Screen scroll header={<Header title="Account" />}>
      {/* Airbnb's profile card (Mobbin, 2026-11-15): a raised card, the initials large in a
          neutral circle, the name and email centred under it. */}
      <View
        style={{
          alignItems: 'center',
          gap: space.s3,
          paddingVertical: space.s7,
          paddingHorizontal: space.s5,
          borderRadius: radius.r4,
          borderCurve: 'continuous',
          backgroundColor: color.surface,
          ...elevation.e3,
        }}
      >
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: radius.rFull,
            // Neutral: violet is for the action and the selected state, never decoration.
            backgroundColor: color.wash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="displaySm" maxScale={1}>
            {initials(name, shown)}
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: space.s1 }}>
          <Text variant="title" align="center" numberOfLines={2}>
            {name === '' ? 'Your account' : name}
          </Text>
          <Text variant="bodySm" tone="textSecondary" align="center" numberOfLines={1}>
            {shown}
          </Text>
        </View>
      </View>
      {modeSwitcher}
      <Stack gap="s1">
        <SectionHeader label="Your details" />
        {details}
      </Stack>
      <Stack gap="s1">
        <SectionHeader label="Help and legal" />
        {link('Help', HELP_URL, CircleHelp)}
        {link('Terms', TERMS_URL, FileText)}
        {link('Privacy', PRIVACY_URL, ShieldCheck)}
      </Stack>
      <Stack gap="s3">
        <Button variant="secondary" label="Sign out" onPress={onSignOut} />
        <View style={{ alignItems: 'center' }}>
          <TextLink label="Delete account" onPress={onDeleteAccount} />
        </View>
        <Text variant="caption" tone="textSecondary" align="center">
          {`Version ${APP_VERSION}`}
        </Text>
      </Stack>
      {field !== null && profile !== null ? (
        <ProfileFieldSheet
          key={opened}
          field={field}
          profile={profile}
          visible={sheetOpen}
          saving={saving}
          onClose={() => {
            setSheetOpen(false);
          }}
          onSave={save}
          onSignIn={() => {
            setSheetOpen(false);
            onSignOut();
          }}
        />
      ) : null}
    </Screen>
  );
}
