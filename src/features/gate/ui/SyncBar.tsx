import { TriangleAlert, Wifi, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { syncLine } from '@/features/gate/domain/syncLine';
import { useSyncView } from '@/features/gate/state/syncView';
import { color, density, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

type Props = {
  onRefreshList: () => void;
  onSyncNow: () => void;
  onOpenAttention: () => void;
  nowMs?: number;
};

function Small({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: density.gate.minTarget,
        justifyContent: 'center',
        paddingHorizontal: space.s2,
      }}
    >
      <Text variant="labelSm" tone="linkText">
        {label}
      </Text>
    </Pressable>
  );
}

// Always visible on the scanner (FR-3.9). Re-renders on sync status only, never the camera.
export function SyncBar({ onRefreshList, onSyncNow, onOpenAttention, nowMs }: Props) {
  const status = useSyncView((s) => s.status);
  // Re-evaluated every 30 s so "2 min ago" and the clock warning do not go stale.
  const [tick, setTick] = useState(Date.now);
  useEffect(() => {
    if (nowMs !== undefined) return;
    const id = setInterval(() => {
      setTick(Date.now());
    }, 30_000);
    return () => {
      clearInterval(id);
    };
  }, [nowMs]);
  const line = syncLine(status, nowMs ?? tick);
  const glyph = status.mode === 'offline' ? WifiOff : Wifi;
  const attention = status.attention;
  return (
    <View
      testID="sync-bar"
      style={{
        backgroundColor: line.tone === 'normal' ? color.surface : color.status.warning.bg,
        borderBottomWidth: 1,
        borderBottomColor: color.border,
        paddingHorizontal: space.s4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
        <Icon as={glyph} color={color.textPrimary} size={16} />
        <Text
          variant="labelSm"
          style={{ flex: 1 }}
          accessibilityLiveRegion="polite"
          numberOfLines={2}
        >
          {line.text}
        </Text>
        {status.pending > 0 ? (
          <Small label="Sync now" onPress={onSyncNow} />
        ) : (
          <Small label="Refresh list" onPress={onRefreshList} />
        )}
      </View>
      {line.warning !== null ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s2,
            paddingBottom: space.s2,
          }}
        >
          <Icon as={TriangleAlert} color={color.status.warning.fg} size={16} />
          <Text variant="labelSm" style={{ color: color.status.warning.fg }}>
            {line.warning}
          </Text>
        </View>
      ) : null}
      {attention > 0 ? (
        <Small
          label={`${String(attention)} ${attention === 1 ? 'needs' : 'need'} attention`}
          onPress={onOpenAttention}
        />
      ) : null}
    </View>
  );
}
