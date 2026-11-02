import { View } from 'react-native';

import { PRIVACY_URL, TERMS_URL } from '@/shared/config/store';
import { space } from '@/shared/theme';
import { Text, TextLink } from '@/shared/ui';

// Footer line under Welcome and Create account: one caption with two caption-sized links.
export function TermsLine({
  onOpenLink,
  inverse = false,
}: {
  onOpenLink: (url: string) => void;
  /** White text and links, for the line over the Welcome photo. */
  inverse?: boolean;
}) {
  const textTone = inverse ? 'onInverse' : 'textSecondary';
  const linkTone = inverse ? 'onInverse' : 'link';
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
      <Text variant="caption" tone={textTone}>
        By continuing you agree to our
      </Text>
      <TextLink
        label="Terms"
        size="sm"
        tone={linkTone}
        onPress={() => {
          onOpenLink(TERMS_URL);
        }}
      />
      <Text variant="caption" tone={textTone}>
        and
      </Text>
      <TextLink
        label="Privacy policy"
        size="sm"
        tone={linkTone}
        onPress={() => {
          onOpenLink(PRIVACY_URL);
        }}
      />
    </View>
  );
}
