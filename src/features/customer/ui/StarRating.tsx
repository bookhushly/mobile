import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { color, iconSize, iconStroke, space } from '@/shared/theme';
import { Text, useDensity } from '@/shared/ui';

export const RATING_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;
const STARS = [1, 2, 3, 4, 5] as const;

type Props = {
  /** 0 = not rated yet. */
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  testID?: string;
};

export function ratingWord(n: number): string | null {
  return RATING_WORDS[n - 1] ?? null;
}

// Spec §6: a radio group ("Rating, 4 of 5, Very good"), each star a ≥ 44 pt radio, the word under
// the stars. No bounce at all, so Reduce Motion has nothing to turn off.
export function StarRating({ value, onChange, disabled = false, testID = 'star-rating' }: Props) {
  const d = useDensity();
  const word = ratingWord(value);
  const groupLabel = word === null ? 'Rating, not set' : `Rating, ${String(value)} of 5, ${word}`;
  return (
    <View style={{ gap: space.s2, alignItems: 'flex-start' }}>
      <View
        testID={testID}
        accessibilityRole="radiogroup"
        accessibilityLabel={groupLabel}
        style={{ flexDirection: 'row', gap: space.s1 }}
      >
        {STARS.map((n) => {
          const on = n <= value;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityLabel={`${String(n)} of 5, ${RATING_WORDS[n - 1] ?? ''}`}
              accessibilityState={{ checked: n === value, disabled }}
              disabled={disabled}
              hitSlop={space.s1}
              onPress={() => {
                onChange(n);
              }}
              style={{
                minWidth: d.minTarget,
                minHeight: d.minTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Star
                size={iconSize.lg}
                strokeWidth={iconStroke}
                color={on ? color.actionFill : color.borderStrong}
                fill={on ? color.actionFill : 'transparent'}
              />
            </Pressable>
          );
        })}
      </View>
      <Text variant="bodyStrong" tone={word === null ? 'textSecondary' : 'textPrimary'}>
        {word ?? 'Tap a star to rate'}
      </Text>
    </View>
  );
}
