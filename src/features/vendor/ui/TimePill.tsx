import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

/** A white pill over a photo's top-left corner: "9:00 · in 40 min", "5 h left". */
export function TimePill({ icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: space.s4,
        top: space.s4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s2,
        backgroundColor: color.surface,
        borderRadius: radius.rFull,
        paddingVertical: space.s2,
        paddingHorizontal: space.s4,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
      }}
    >
      <Icon as={icon} size="xs" />
      <Text variant="labelSm" tabular>
        {label}
      </Text>
    </View>
  );
}
