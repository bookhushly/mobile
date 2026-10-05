import { useKeepAwake } from 'expo-keep-awake';
import { Flashlight, Keyboard, ListChecks, Volume2, VolumeX } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OverlayView, ScanSession } from '@/features/gate/domain/scanSession';
import type { ScanSummary } from '@/features/gate/schemas/scan';
import { useScanView } from '@/features/gate/state/scanView';
import { EnterCodeSheet } from '@/features/gate/ui/EnterCodeSheet';
import { OutcomeOverlay } from '@/features/gate/ui/OutcomeOverlay';
import { RecentSheet } from '@/features/gate/ui/RecentSheet';
import { ScannerCamera, type CameraPermission } from '@/features/gate/ui/ScannerCamera';
import { color, density, radius, space } from '@/shared/theme';
import { Button, Icon, Text } from '@/shared/ui';

type Props = {
  title: string;
  summary: ScanSummary | null;
  summaryStale: boolean;
  focused: boolean;
  permission: CameraPermission;
  canAskPermission: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  muted: boolean;
  onToggleMute: () => void;
  session: Pick<ScanSession, 'scan' | 'tryAgain' | 'dismiss'>;
  onSignIn: () => void;
  onChangeEvent: () => void;
};

const CORNER = 32;
const EDGE = 4;
const corners = [
  { top: 0, left: 0, borderTopWidth: EDGE, borderLeftWidth: EDGE },
  { top: 0, right: 0, borderTopWidth: EDGE, borderRightWidth: EDGE },
  { bottom: 0, left: 0, borderBottomWidth: EDGE, borderLeftWidth: EDGE },
  { bottom: 0, right: 0, borderBottomWidth: EDGE, borderRightWidth: EDGE },
] as const;

function Viewfinder() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: '70%', aspectRatio: 1 }}>
        {corners.map((c, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: CORNER,
              height: CORNER,
              borderColor: color.onAction,
              ...c,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Control({
  label,
  glyph,
  onPress,
  selected,
}: {
  label: string;
  glyph: Parameters<typeof Icon>[0]['as'];
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: selected === true }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: density.gate.controlHeight,
        borderRadius: radius.r3,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.s2,
        backgroundColor: pressed || selected === true ? color.wash : color.surface,
        borderWidth: 1,
        borderColor: color.border,
      })}
    >
      <Icon as={glyph} color={color.textPrimary} />
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

// Keyed by overlay id so the time used for wording is fixed when each overlay appears.
function OverlayFor(p: Pick<Props, 'session' | 'onSignIn'> & { view: OverlayView }) {
  const [nowMs] = useState(() => Date.now());
  return (
    <OutcomeOverlay
      view={p.view}
      nowMs={nowMs}
      onDismiss={p.session.dismiss}
      onTryAgain={p.session.tryAgain}
      onSignIn={p.onSignIn}
    />
  );
}

function Overlay(p: Pick<Props, 'session' | 'onSignIn'>) {
  const current = useScanView((s) => s.view.current);
  if (current === null) return null;
  return <OverlayFor key={current.id} view={current} session={p.session} onSignIn={p.onSignIn} />;
}

function Checking() {
  const pending = useScanView((s) => s.view.pending);
  if (pending === 0) return null;
  return (
    <Text variant="label" tone="onAction" accessibilityLiveRegion="polite">
      {`Checking ${String(pending)}…`}
    </Text>
  );
}

export function ScannerScreen(p: Props) {
  useKeepAwake();
  const [torch, setTorch] = useState(false);
  const [entering, setEntering] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const counter =
    p.summary === null ? '— / —' : `${String(p.summary.admitted)} / ${String(p.summary.total)}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.textPrimary }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s4,
          padding: space.s4,
          backgroundColor: color.surface,
        }}
      >
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {p.title}
          </Text>
          <Pressable accessibilityRole="link" onPress={p.onChangeEvent} hitSlop={12}>
            <Text variant="labelSm" tone="linkText">
              Change event
            </Text>
          </Pressable>
        </View>
        <View accessibilityLabel={`Admitted ${counter}`}>
          <Text variant="num" tabular>
            {counter}
          </Text>
          {p.summaryStale ? (
            <Text variant="caption" tone="textMuted">
              not updated
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.muted ? 'Sound off' : 'Sound on'}
          onPress={p.onToggleMute}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon as={p.muted ? VolumeX : Volume2} color={color.textPrimary} />
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {p.permission === 'granted' && p.focused ? (
          <>
            <ScannerCamera
              torch={torch}
              onCode={(raw) => {
                p.session.scan(raw, 'camera');
              }}
            />
            <Viewfinder />
          </>
        ) : null}
        {p.permission === 'denied' ? (
          <View style={{ flex: 1, padding: space.s6, justifyContent: 'center', gap: space.s5 }}>
            <Text variant="title" tone="onAction">
              Camera access is off
            </Text>
            <Text variant="body" tone="onAction">
              Turn on camera access for Bookhushly to scan tickets. You can still enter codes by
              hand.
            </Text>
            {p.canAskPermission ? (
              <Button label="Allow camera" onPress={p.onRequestPermission} />
            ) : (
              <Button label="Open settings" onPress={p.onOpenSettings} />
            )}
          </View>
        ) : null}
        <View style={{ position: 'absolute', top: space.s4, left: space.s4 }}>
          <Checking />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: space.s4,
          padding: space.s4,
          backgroundColor: color.surface,
        }}
      >
        <Control
          label="Torch"
          glyph={Flashlight}
          selected={torch}
          onPress={() => {
            setTorch((t) => !t);
          }}
        />
        <Control
          label="Enter code"
          glyph={Keyboard}
          onPress={() => {
            setEntering(true);
          }}
        />
        <Control
          label="Recent"
          glyph={ListChecks}
          onPress={() => {
            setShowRecent(true);
          }}
        />
      </View>

      <Overlay session={p.session} onSignIn={p.onSignIn} />

      <EnterCodeSheet
        visible={entering}
        onClose={() => {
          setEntering(false);
        }}
        onSubmit={(raw) => {
          setEntering(false);
          p.session.scan(raw, 'manual');
        }}
      />
      <RecentSheet
        visible={showRecent}
        recent={p.summary?.recent ?? null}
        onClose={() => {
          setShowRecent(false);
        }}
      />
    </SafeAreaView>
  );
}
