import { View } from 'react-native';

import { longDate, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Text, TextLink } from '@/shared/ui';

/** The top of every Today: the business, the date, and the day in a line or two. */
export function TodayTop({
  businessName,
  kindWord,
  today,
  lines,
}: {
  businessName: string;
  kindWord: string;
  today: IsoDate;
  lines: string[];
}) {
  return (
    <>
      <View style={{ gap: space.s1 }}>
        <Text variant="label">{businessName}</Text>
        <Text variant="caption" tone="textSecondary">
          {kindWord}
        </Text>
      </View>
      <View style={{ gap: space.s2 }}>
        <Text variant="labelSm" tone="textSecondary">
          {longDate(today)}
        </Text>
        <Text variant="titleLg" accessibilityRole="header" testID="vendor-headline">
          {lines.join('\n')}
        </Text>
      </View>
    </>
  );
}

/** A section title with its link on the right ("Up next" … "All jobs"). */
export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s4 }}>
      <Text variant="headline" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {action === undefined || onAction === undefined ? null : (
        <TextLink label={action} onPress={onAction} />
      )}
    </View>
  );
}
