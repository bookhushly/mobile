import { CircleAlert, CircleCheck, CircleX, RotateCw } from 'lucide-react-native';
import { useContext } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import type { OverlayView } from '@/features/gate/domain/scanSession';
import { present, type Tone } from '@/features/gate/domain/present';
import { color, density, radius, space } from '@/shared/theme';
import { Text } from '@/shared/ui';

const GLYPH = {
  admitted: CircleCheck,
  used: CircleAlert,
  refused: CircleX,
  retry: RotateCw,
} as const;

// Gate results never grow with Dynamic Type: the actions must stay on screen.
const SCALE = 1;

type Props = {
  view: OverlayView;
  nowMs: number;
  onDismiss: (id: number) => void;
  onTryAgain: (id: number) => void;
  onSignIn: () => void;
};

function Action({ label, fg, onPress }: { label: string; fg: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: density.gate.controlHeight,
        borderRadius: radius.r3,
        borderWidth: 2,
        borderColor: fg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.s7,
      }}
    >
      <Text variant="headline" maxScale={SCALE} style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Solid D9 fills, no entrance animation (MOTION.md: no Lottie on gate outcomes).
// The full-bleed Pressable is not an accessibility element (iOS would collapse the buttons
// into it); the alert lives on the inner, non-pressable result block.
export function OutcomeOverlay({ view, nowMs, onDismiss, onTryAgain, onSignIn }: Props) {
  const p = present(view.outcome, nowMs);
  const tone: Tone = p.tone;
  const { bg, fg } = color.outcome[tone];
  const Glyph = GLYPH[tone];
  const chip = view.extraAdmitted > 0 ? `+${String(view.extraAdmitted)} admitted` : null;
  const announced = [p.title, p.detail, p.secondary, p.tag, chip]
    .filter((s): s is string => s !== null && s !== '')
    .join('. ');
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  const dismiss = () => {
    onDismiss(view.id);
  };
  return (
    <Pressable
      testID="outcome-overlay"
      accessible={false}
      onPress={p.holdMs === null ? undefined : dismiss}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: bg,
      }}
    >
      <View
        testID="outcome-content"
        style={{
          flex: 1,
          padding: space.s7,
          paddingTop: insets.top + space.s7,
          paddingBottom: insets.bottom + space.s7,
        }}
      >
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }}>
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            accessibilityLabel={announced}
            style={{ gap: space.s6 }}
          >
            <View testID={`outcome-icon-${p.title}`}>
              <Glyph size={96} color={fg} strokeWidth={2} />
            </View>
            <Text variant="display" maxScale={SCALE} style={{ color: fg }}>
              {p.title}
            </Text>
            {p.detail !== '' ? (
              <Text variant="titleLg" maxScale={SCALE} style={{ color: fg }}>
                {p.detail}
              </Text>
            ) : null}
            {p.secondary !== null ? (
              <Text variant="headline" maxScale={SCALE} style={{ color: fg }}>
                {p.secondary}
              </Text>
            ) : null}
            {p.tag !== null ? (
              <Text variant="label" maxScale={SCALE} style={{ color: fg }}>
                {p.tag}
              </Text>
            ) : null}
            {chip !== null ? (
              <Text variant="label" maxScale={SCALE} style={{ color: fg }}>
                {chip}
              </Text>
            ) : null}
          </View>
        </ScrollView>
        {p.action !== null ? (
          <View
            testID="outcome-actions"
            style={{ marginTop: 'auto', paddingTop: space.s6, gap: density.gate.targetGap }}
          >
            {p.action === 'tryAgain' ? (
              <Action
                label="Try again"
                fg={fg}
                onPress={() => {
                  onTryAgain(view.id);
                }}
              />
            ) : null}
            {p.action === 'signIn' ? (
              <Action
                label="Sign in again"
                fg={fg}
                onPress={() => {
                  onSignIn();
                }}
              />
            ) : null}
            {p.action === 'done' ? <Action label="Done" fg={fg} onPress={dismiss} /> : null}
            {p.action === 'tryAgain' || p.action === 'signIn' ? (
              <Action label="Dismiss" fg={fg} onPress={dismiss} />
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
