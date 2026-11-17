import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { color, elevation, radius, space, type ColorRole } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

type Tone = 'surface' | 'dark' | 'success';

const TONES: Record<Tone, { bg: string; fg: ColorRole; lifted: boolean }> = {
  surface: { bg: color.surface, fg: 'textPrimary', lifted: true },
  dark: { bg: color.accent.dark.bg, fg: 'onInverse', lifted: true },
  // A status tint reads as a label on the panel, not a floating object: no shadow.
  success: { bg: color.status.success.bg, fg: 'successFg', lifted: false },
};

type Props = { icon: LucideIcon; label: string; tone?: Tone };

/** A pill of the tour's panel: an icon and a few words about the app. Decorative. */
export function TourChip({ icon, label, tone = 'surface' }: Props) {
  const t = TONES[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s2,
          paddingVertical: space.s2,
          paddingHorizontal: space.s4,
          borderRadius: radius.rFull,
          backgroundColor: t.bg,
        },
        t.lifted ? elevation.e3 : null,
      ]}
    >
      <Icon as={icon} size={16} tone={t.fg} />
      <Text variant="labelSm" tone={t.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
