import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from './Icon';
import { Input } from './Input';

type Props = Omit<Parameters<typeof Input>[0], 'secureTextEntry' | 'right'>;

// Input with a show/hide toggle; the toggle is the only trailing slot so the field stays one target.
export function PasswordField(props: Props) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!shown}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          // The slop never reaches left into the text; the box itself is a full target.
          hitSlop={{ left: 0, right: 12, top: 12, bottom: 12 }}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => {
            setShown((s) => !s);
          }}
        >
          <Icon as={shown ? EyeOff : Eye} size="sm" tone="textSecondary" />
        </Pressable>
      }
    />
  );
}
