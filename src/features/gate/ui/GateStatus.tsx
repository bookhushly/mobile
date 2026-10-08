import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';

import { statusPill } from '@/features/gate/domain/statusPill';
import type { ActivityTab } from '@/features/gate/offline/outboxStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { StatusPill, Text } from '@/shared/ui';

type Props = { now: () => number; onOpen: (tab: ActivityTab) => void };

// Always visible on the scanner (FR-3.9). Re-renders on sync status and a 30 s tick only.
export function GateStatus({ now, onOpen }: Props) {
  const status = useSyncView((s) => s.status);
  // The tick lives in state so the wording is recomputed from it (a bare counter is memoised away).
  const [nowMs, setNowMs] = useState(() => now());
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(now());
    }, 30_000);
    return () => {
      clearInterval(id);
    };
  }, [now]);
  const pill = statusPill(status, nowMs);
  // iOS has no live region: VoiceOver is told once per state change, never on a minute tick.
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    const prev = spoken.current;
    spoken.current = pill.announceKey;
    if (prev === null || prev === pill.announceKey || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(pill.text);
  }, [pill.announceKey, pill.text]);
  return (
    <View testID="gate-status" style={{ flexShrink: 1, alignItems: 'flex-end' }}>
      <StatusPill
        tone={pill.tone}
        label={pill.text}
        numberOfLines={2}
        onPress={() => {
          onOpen(pill.tab);
        }}
      />
      {/* Android live region, keyed by state so a change is heard once, never the minute ticks.
          Hidden from VoiceOver's swipe order (it is announced above instead). */}
      <View
        accessibilityLiveRegion="polite"
        accessibilityElementsHidden
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      >
        <Text key={pill.announceKey} testID="gate-status-live" variant="caption">
          {pill.text}
        </Text>
      </View>
    </View>
  );
}
