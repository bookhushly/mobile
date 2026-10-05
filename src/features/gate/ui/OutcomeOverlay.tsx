import { CircleAlert, CircleCheck, CircleX, RotateCw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

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
      <Text variant="headline" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Solid D9 fills, no entrance animation (MOTION.md: no Lottie on gate outcomes).
export function OutcomeOverlay({ view, nowMs, onDismiss, onTryAgain, onSignIn }: Props) {
  const p = present(view.outcome, nowMs);
  const tone: Tone = p.tone;
  const { bg, fg } = color.outcome[tone];
  const Glyph = GLYPH[tone];
  return (
    <Pressable
      testID="outcome-overlay"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${p.title}. ${p.detail}`}
      onPress={
        p.holdMs === null
          ? undefined
          : () => {
              onDismiss(view.id);
            }
      }
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: bg,
        padding: space.s7,
        justifyContent: 'center',
        gap: space.s6,
      }}
    >
      <View testID={`outcome-icon-${p.title}`}>
        <Glyph size={96} color={fg} strokeWidth={2} />
      </View>
      <Text variant="display" style={{ color: fg }}>
        {p.title}
      </Text>
      {p.detail !== '' ? (
        <Text variant="titleLg" style={{ color: fg }}>
          {p.detail}
        </Text>
      ) : null}
      {p.secondary !== null ? (
        <Text variant="headline" style={{ color: fg }}>
          {p.secondary}
        </Text>
      ) : null}
      {view.extraAdmitted > 0 ? (
        <Text variant="label" style={{ color: fg }}>
          {`+${String(view.extraAdmitted)} admitted`}
        </Text>
      ) : null}
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
      {p.action === 'done' ? (
        <Action
          label="Done"
          fg={fg}
          onPress={() => {
            onDismiss(view.id);
          }}
        />
      ) : null}
      {p.action === 'tryAgain' || p.action === 'signIn' ? (
        <Action
          label="Dismiss"
          fg={fg}
          onPress={() => {
            onDismiss(view.id);
          }}
        />
      ) : null}
    </Pressable>
  );
}
