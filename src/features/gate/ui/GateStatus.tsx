import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { statusPill } from '@/features/gate/domain/statusPill';
import type { ActivityTab } from '@/features/gate/offline/outboxStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { StatusPill, Text } from '@/shared/ui';

type Props = { now: () => number; onOpen: (tab: ActivityTab) => void };

// Always visible on the scanner (FR-3.9). Re-renders on sync status and a 30 s tick only.
export function GateStatus({ now, onOpen }: Props) {
  const status = useSyncView((s) => s.status);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
    }, 30_000);
    return () => {
      clearInterval(id);
    };
  }, []);
  const pill = statusPill(status, now());
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <StatusPill
        tone={pill.tone}
        label={pill.text}
        onPress={() => {
          onOpen(pill.tab);
        }}
      />
      {/* Keyed by state, not text: a screen reader hears a change once, never the minute ticks. */}
      <View
        accessibilityLiveRegion="polite"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      >
        <Text key={pill.announceKey} testID="gate-status-live" variant="caption">
          {pill.text}
        </Text>
      </View>
    </View>
  );
}
