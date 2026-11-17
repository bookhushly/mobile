import { View } from 'react-native';

import { PRIVACY_URL, TERMS_URL } from '@/shared/config/store';
import { space } from '@/shared/theme';
import { Text, TextLink } from '@/shared/ui';

// Footer line under the Sign in and Create account forms, where the agreement happens: fine print (14) with two links at the same size.
export function TermsLine({ onOpenLink }: { onOpenLink: (url: string) => void }) {
  const textTone = 'textSecondary';
  const linkTone = 'link';
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
      <Text variant="bodySm" tone={textTone}>
        By continuing you agree to our
      </Text>
      <TextLink
        label="Terms"
        inline
        tone={linkTone}
        onPress={() => {
          onOpenLink(TERMS_URL);
        }}
      />
      <Text variant="bodySm" tone={textTone}>
        and
      </Text>
      <TextLink
        label="Privacy policy"
        inline
        tone={linkTone}
        onPress={() => {
          onOpenLink(PRIVACY_URL);
        }}
      />
    </View>
  );
}
