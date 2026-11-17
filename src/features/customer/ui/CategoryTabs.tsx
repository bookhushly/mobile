import { BedDouble, Building2, Ticket, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Category } from '@/features/customer/domain/discover';
import { CATEGORY_OPTIONS } from '@/features/customer/ui/discoverLabels';
import { borderWidth, color, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';
import { useDensity } from '@/shared/ui/DensityProvider';

// The same icon for each kind as Bookings uses.
const ICON: Record<Category, LucideIcon> = {
  hotels: BedDouble,
  serviced_apartments: Building2,
  events: Ticket,
};

type Props = { value: Category; onChange: (c: Category) => void; testID?: string };

/**
 * The kind of place to search, as Airbnb's Homes · Experiences tabs (search direction A, owner's
 * pick 2026-11-15): an icon over each word, the chosen one in ink with an ink line under it, the
 * others grey, a hairline under the row.
 */
export function CategoryTabs({ value, onChange, testID }: Props) {
  const { minTarget } = useDensity();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        gap: space.s7,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
      }}
    >
      {CATEGORY_OPTIONS.map((o) => {
        const selected = o.value === value;
        const tone = selected ? 'textPrimary' : 'textMuted';
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(o.value);
            }}
            style={{
              minHeight: minTarget,
              alignItems: 'center',
              gap: space.s1,
              paddingTop: space.s2,
              paddingBottom: space.s3,
              // Sits on the row's hairline, so the chosen tab's line replaces it.
              marginBottom: -borderWidth.hairline,
              borderBottomWidth: borderWidth.thick,
              borderBottomColor: selected ? color.textPrimary : 'transparent',
            }}
          >
            <Icon as={ICON[o.value]} size={20} tone={tone} />
            <Text variant="labelSm" tone={tone}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
