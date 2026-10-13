import { useState } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Text, TextLink } from '@/shared/ui';

const LINES = 6;
const LONG_CHARS = 280;

// Mobbin §4 (Marriott): a short description with Read more. Plain text only (no HTML rendering).
export function ReadMoreText({ text, testID }: { text: string; testID?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG_CHARS || text.split('\n').length > LINES;
  return (
    <View style={{ gap: space.s2 }}>
      <Text variant="body" numberOfLines={long && !open ? LINES : undefined} testID={testID}>
        {text}
      </Text>
      {long ? (
        <TextLink
          label={open ? 'Show less' : 'Read more'}
          onPress={() => {
            setOpen((o) => !o);
          }}
        />
      ) : null}
    </View>
  );
}
