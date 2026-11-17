import { View } from 'react-native';

import type { CardPrice } from '@/features/customer/domain/listingCard';
import { space } from '@/shared/theme';
import { formatNaira, Text } from '@/shared/ui';

type Props = {
  price: CardPrice;
  /** Airbnb's results: the amount underlined, as the thing to tap for the details. */
  underline?: boolean;
  /**
   * The booking bar (DICE, owner's pick A, 2026-11-15): the amount large, and a range read as its
   * lowest ("From ₦15,000") so the bar leads with one number.
   */
  lead?: boolean;
  testID?: string;
};

// "45,000 naira": screen readers say the word, not "N 45,000" (spec §6).
export const spokenNaira = (n: number) => `${formatNaira(n).replace('₦', '')} naira`;

function words(
  price: NonNullable<CardPrice>,
  lead = false,
): {
  shown: string;
  unit: string | null;
  spoken: string;
} {
  if ('text' in price) return { shown: price.text, unit: null, spoken: price.text };
  if ('min' in price) {
    // D5: a 0 tier reads "Free", never "₦0".
    const free = price.min <= 0;
    if (lead && !free)
      return {
        shown: `From ${formatNaira(price.min)}`,
        unit: null,
        spoken: `From ${spokenNaira(price.min)}`,
      };
    return {
      shown: `${free ? 'Free' : formatNaira(price.min)} – ${formatNaira(price.max)}`,
      unit: null,
      spoken: `${free ? 'Free' : spokenNaira(price.min)} to ${spokenNaira(price.max)}`,
    };
  }
  const prefix = 'prefix' in price ? `${price.prefix} ` : '';
  const unit = 'unit' in price ? price.unit : null;
  return {
    shown: `${prefix}${formatNaira(price.amount)}`,
    unit: unit === null ? null : `/ ${unit}`,
    spoken: `${prefix}${spokenNaira(price.amount)}${unit === null ? '' : ` per ${unit}`}`,
  };
}

/** The price as a screen reader says it ("From 45,000 naira per night"); null → nothing. */
export function priceSpoken(price: CardPrice): string | null {
  return price === null ? null : words(price).spoken;
}

// Display only (D5): the web recomputes at booking. A hotel at 0 says "See rooms for prices";
// an event with no price shows nothing.
export function PriceTag({ price, underline = false, lead = false, testID }: Props) {
  if (price === null) return null;
  const w = words(price, lead);
  const isText = 'text' in price && price.text !== 'Free';
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={w.spoken}
      style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s2, flexWrap: 'wrap' }}
    >
      <Text
        variant={isText ? 'bodySm' : lead ? 'headline' : 'bodyStrong'}
        tone={isText ? 'textSecondary' : 'textPrimary'}
        tabular={!isText}
        numberOfLines={1}
        style={underline && !isText ? { textDecorationLine: 'underline' } : undefined}
      >
        {w.shown}
      </Text>
      {w.unit !== null ? (
        <Text variant="bodySm" tone="textSecondary">
          {w.unit}
        </Text>
      ) : null}
    </View>
  );
}
