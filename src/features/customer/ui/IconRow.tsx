import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { space, typeVariants } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string | null;
  /** Makes the row a link (Maps, a sheet), with a chevron. */
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

// Expedia's "Highlights" and Meetup's event rows, drawn the Airbnb/Hyatt way: a bare ink icon level
// with a strong line, and an optional grey one under it.
export function IconRow({ icon, title, subtitle, onPress, accessibilityLabel, testID }: Props) {
  const d = useDensity();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.s4 }}>
      {/* Icon rules (DESIGN_SYSTEM §6): bare, ink, 24 pt beside a row's text, no disc. */}
      <View style={{ height: typeVariants.bodyStrong.lineHeight, justifyContent: 'center' }}>
        <Icon as={icon} size="md" />
      </View>
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle !== undefined && subtitle !== null && subtitle !== '' ? (
          <Text
            variant="bodySm"
            tone="textSecondary"
            style={onPress !== undefined ? { textDecorationLine: 'underline' } : undefined}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onPress !== undefined ? <Icon as={ChevronRight} size="sm" tone="textSecondary" /> : null}
    </View>
  );
  if (onPress === undefined)
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
        style={{ minHeight: d.minTarget, justifyContent: 'center' }}
      >
        {body}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: d.minTarget,
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {body}
    </Pressable>
  );
}
