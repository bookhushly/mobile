import { ArrowRight, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { color, density, radius, space } from '@/shared/theme';
import { Icon, PressableScale, Text } from '@/shared/ui';

type Props = {
  title: string;
  body: string;
  /** The pill's label; the whole card is the button. */
  action: string;
  onPress: () => void;
  /** Drawn large in the corner, in a deeper shade of the card's colour. */
  icon: LucideIcon;
  /** `dark`: the ink block (the lead promo, one per screen); `tint`: a quieter violet-50 block. */
  tone: 'dark' | 'tint';
  testID?: string;
};

// Owner's picks (2026-11-15): Expedia's flat-colour home promo, laid out like a printed ad: the
// headline, one line and a dark pill at the top left, and the icon drawn large in a deeper shade,
// tilted and bleeding off the bottom-right corner. Text on flat colour, so it reads at any
// size; the lead card is ink with white text and a white pill, in brand colours (owner, 2026-11-15: no
// yellow fills). Only true statements about Bookhushly: never an invented discount or count.
export function PromoCard({ title, body, action, onPress, icon, tone, testID }: Props) {
  const dark = tone === 'dark';
  const c = dark ? color.accent.dark : color.accent.tint;
  const ink = dark ? ('onInverse' as const) : undefined;
  const pillInk = dark ? undefined : ('onInverse' as const);
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body} ${action}`}
      onPress={onPress}
    >
      <View
        style={{
          padding: space.s7,
          borderRadius: radius.r4,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: c.bg,
        }}
      >
        <View
          accessible={false}
          style={{
            position: 'absolute',
            right: -space.s7,
            bottom: -space.s8,
            transform: [{ rotate: '-18deg' }],
          }}
        >
          <Icon as={icon} size="xxl" color={c.deep} strokeWidth={1.5} />
        </View>
        <View style={{ maxWidth: '72%', gap: space.s3 }}>
          <Text variant="displaySm" tone={ink}>
            {title}
          </Text>
          <Text variant="bodySm" tone={ink}>
            {body}
          </Text>
        </View>
        <View
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s3,
            marginTop: space.s6,
            minHeight: density.customer.minTarget,
            paddingHorizontal: space.s6,
            borderRadius: radius.rFull,
            backgroundColor: dark ? color.onInverse : color.inverse,
          }}
        >
          <Text variant="label" tone={pillInk}>
            {action}
          </Text>
          <Icon as={ArrowRight} size="sm" tone={pillInk} />
        </View>
      </View>
    </PressableScale>
  );
}
