import type { LucideIcon } from 'lucide-react-native';
import { useContext, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { color, density, iconSize, space } from '@/shared/theme';

import { Button } from './Button';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

export type OutcomeTone = 'admitted' | 'used' | 'refused' | 'retry';

// Gate results never grow with Dynamic Type: the actions must stay on screen.
const SCALE = 1;

type Props = {
  tone: OutcomeTone;
  icon: LucideIcon;
  title: string;
  lines: { text: string; size: 'detail' | 'secondary' }[];
  tags: string[];
  /** Everything a screen reader should hear, in order. */
  announced: string;
  onBackdropPress?: () => void;
  actions?: ReactNode;
  iconTestID?: string;
  testID?: string;
};

// D9 solid fills, no entrance animation. The full-bleed Pressable is not an accessibility
// element (iOS would collapse the buttons into it); the alert is the inner result block.
// The result sits in the lower two-thirds (`marginTop: 'auto'`), the actions under it.
export function OutcomeScreen({
  tone,
  icon: Glyph,
  title,
  lines,
  tags,
  announced,
  onBackdropPress,
  actions,
  iconTestID,
  testID,
}: Props) {
  const { bg, fg } = color.outcome[tone];
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  return (
    <Pressable
      testID={testID}
      accessible={false}
      onPress={onBackdropPress}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: bg }}
    >
      <View
        testID="outcome-content"
        style={{
          flex: 1,
          padding: space.s7,
          paddingTop: insets.top + space.s9,
          paddingBottom: insets.bottom + space.s7,
        }}
      >
        <ScrollView testID="outcome-result" style={{ flexGrow: 0, flexShrink: 1, marginTop: 'auto' }}>
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            accessibilityLabel={announced}
            style={{ gap: space.s5 }}
          >
            <View testID={iconTestID}>
              <Glyph size={iconSize.xxl} color={fg} strokeWidth={2} />
            </View>
            <Text variant="outcome" maxScale={SCALE} style={{ color: fg }}>
              {title}
            </Text>
            {lines.map((l) => (
              <Text
                key={l.text}
                variant={l.size === 'detail' ? 'titleLg' : 'headline'}
                maxScale={SCALE}
                style={{ color: fg }}
              >
                {l.text}
              </Text>
            ))}
            {tags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
                {tags.map((t) => (
                  <StatusPill key={t} tone="neutral" label={t} onFill={fg} testID={`outcome-tag-${t}`} />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
        {actions !== undefined ? (
          <View testID="outcome-actions" style={{ paddingTop: space.s7, gap: density.gate.targetGap }}>
            {actions}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

type ActionProps = {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  dark?: boolean;
};

// `dark` on the amber "Already used" fill: white text there fails contrast, so ink is used.
export function OutcomeAction({ label, onPress, primary = false, disabled, busy, dark = false }: ActionProps) {
  return (
    <Button
      label={label}
      onPress={onPress}
      variant={primary ? 'primary' : 'secondary'}
      onInverse={dark ? 'dark' : 'light'}
      disabled={disabled}
      loading={busy}
      maxScale={SCALE}
    />
  );
}
