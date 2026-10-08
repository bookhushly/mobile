import { Search, X } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { Input } from './Input';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'words';
  testID?: string;
};

// Effective touch target after hitSlop; matches IconButton so gate clears reach 56.
const MIN_EFFECTIVE_TARGET = 56;

export function SearchField({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  autoCapitalize = 'none',
  testID,
}: Props) {
  const d = useDensity();
  const slop = Math.max(0, Math.ceil((MIN_EFFECTIVE_TARGET - d.minTarget) / 2));
  return (
    <Input
      testID={testID}
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoCorrect={false}
      autoComplete="off"
      autoCapitalize={autoCapitalize}
      returnKeyType="search"
      left={<Icon as={Search} size="sm" tone="textMuted" />}
      right={
        value !== '' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={slop}
            onPress={() => {
              onChangeText('');
            }}
            // Trailing edge of the field; the visual box is the density's minimum target.
            style={{
              width: d.minTarget,
              height: d.minTarget,
              marginRight: -d.minTarget / 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon as={X} size="sm" tone="textSecondary" />
          </Pressable>
        ) : null
      }
    />
  );
}
