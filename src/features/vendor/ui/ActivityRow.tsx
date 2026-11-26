import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { View } from 'react-native';

import { activityLine, type Activity } from '@/features/vendor/domain/earnings';
import { borderWidth, color, space } from '@/shared/theme';
import { formatNaira, Icon, Text } from '@/shared/ui';

/** One payment in or out: what it was, when and where it stands, and the amount. */
export function ActivityRow({ activity: a }: { activity: Activity }) {
  const out = a.kind === 'withdrawal';
  return (
    <View
      accessible
      accessibilityLabel={`${a.title}, ${out ? 'out' : 'in'} ${formatNaira(a.amount)}, ${activityLine(a)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        paddingVertical: space.s4,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
      }}
    >
      <Icon as={out ? ArrowUpRight : ArrowDownLeft} size="md" />
      <View style={{ flex: 1, minWidth: 0, gap: space.s1 }}>
        <Text variant="label" numberOfLines={1}>
          {a.title}
        </Text>
        <Text variant="caption" tone="textSecondary" numberOfLines={1}>
          {activityLine(a)}
        </Text>
      </View>
      <Text variant="label" tabular>
        {`${out ? '−' : '+'}${formatNaira(a.amount)}`}
      </Text>
    </View>
  );
}
