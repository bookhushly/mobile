import { ChevronDown, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { borderWidth, color, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Extra line under the subtitle (e.g. a needs-attention reason). */
  note?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  numberOfLines?: number;
  /**
   * A static row reads as one element by default. Pass false when `trailing` is a control
   * (a button) so iOS does not fold it into the row's label and off the swipe order.
   */
  groupAccessibility?: boolean;
  testID?: string;
};

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  note,
  onPress,
  accessibilityLabel,
  numberOfLines = 1,
  groupAccessibility = true,
  testID,
}: Props) {
  const d = useDensity();
  const name =
    accessibilityLabel ?? [title, subtitle].filter((s) => s !== undefined && s !== '').join(', ');
  const body = (
    <>
      {leading}
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodyStrong" numberOfLines={numberOfLines}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text variant="bodySm" tone="textSecondary" numberOfLines={numberOfLines}>
            {subtitle}
          </Text>
        ) : null}
        {note}
      </View>
    </>
  );
  const content = (
    <>
      {body}
      {trailing}
    </>
  );
  const line = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.s4 };
  const style = {
    minHeight: d.rowMin,
    ...line,
    paddingVertical: space.s3,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: color.border,
  };
  if (onPress === undefined) {
    if (groupAccessibility)
      return (
        <View testID={testID} accessible accessibilityLabel={name} style={style}>
          {content}
        </View>
      );
    return (
      <View testID={testID} style={style}>
        <View accessible accessibilityLabel={name} style={{ flex: 1, ...line }}>
          {body}
        </View>
        {trailing}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [style, { backgroundColor: pressed ? color.wash : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

type SectionProps = { label: string; count?: number; expanded?: boolean; onToggle?: () => void };

export function SectionHeader({ label, count, expanded, onToggle }: SectionProps) {
  const d = useDensity();
  const text = count === undefined ? label : `${label} (${String(count)})`;
  if (onToggle === undefined)
    return (
      <View style={{ minHeight: 40, justifyContent: 'flex-end', paddingBottom: space.s2 }}>
        <Text variant="label" tone="textSecondary" accessibilityRole="header">
          {text}
        </Text>
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ expanded: expanded === true }}
      onPress={onToggle}
      style={{ minHeight: d.minTarget, flexDirection: 'row', alignItems: 'center', gap: space.s2 }}
    >
      <Text variant="label" tone="textSecondary" style={{ flex: 1 }}>
        {text}
      </Text>
      <Icon as={expanded === true ? ChevronDown : ChevronRight} size="sm" tone="textSecondary" />
    </Pressable>
  );
}
