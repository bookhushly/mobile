import { View } from 'react-native';

import { PRIVACY_URL, TERMS_URL } from '@/shared/config/store';
import { space } from '@/shared/theme';
import { Text, TextLink } from '@/shared/ui';

// Footer line under Welcome and Create account: one caption with two caption-sized links.
export function TermsLine({ onOpenLink }: { onOpenLink: (url: string) => void }) {
  return (
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
        size="sm"
        onPress={() => {
          onOpenLink(TERMS_URL);
        }}
      />
      <Text variant="caption" tone="textSecondary">
        and
      </Text>
      <TextLink
        label="Privacy policy"
        size="sm"
        onPress={() => {
          onOpenLink(PRIVACY_URL);
        }}
      />
    </View>
  );
}
