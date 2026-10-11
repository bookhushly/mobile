import { Pressable, View } from 'react-native';

import type { GuestTab } from '@/features/receptionist/domain/guestLists';
import { color, radius, space } from '@/shared/theme';
import { Card, Text, useDensity, useWide } from '@/shared/ui';

export type CountKey = GuestTab | 'freeRooms';
export type Counts = Record<GuestTab, number> & {
  /** null while the room board hasn't loaded (its failure never hides the guest counts). */
  freeRooms: number | null;
};

type Props = { counts: Counts; onPress: (key: CountKey) => void; testID?: string };

const CELLS: readonly { key: CountKey; label: string }[] = [
  { key: 'arriving', label: 'Arriving' },
  { key: 'inHouse', label: 'In house' },
  { key: 'leaving', label: 'Leaving' },
  { key: 'freeRooms', label: 'Free rooms' },
];

// One white card with four count cells (Mobbin §1: Asana/Reminders; no saturated fills).
// 2×2 on phones, one row of four on tablets. Each cell reads as "Arriving, 4" (spec §7).
export function CountCard({ counts, onPress, testID }: Props) {
  const wide = useWide();
  const d = useDensity();
  return (
    <Card>
      <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CELLS.map((c) => {
          const n = counts[c.key];
          const shown = n === null ? '—' : String(n);
          const spoken = n === null ? `${c.label}, not loaded` : `${c.label}, ${String(n)}`;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={spoken}
              onPress={() => {
                onPress(c.key);
              }}
              style={({ pressed }) => ({
                width: wide ? '25%' : '50%',
                minHeight: d.minTarget,
                paddingVertical: space.s3,
                paddingHorizontal: space.s3,
                gap: space.s1,
                borderRadius: radius.r2,
                backgroundColor: pressed ? color.wash : 'transparent',
              })}
            >
              <Text variant="titleLg" tabular maxScale={1.3}>
                {shown}
              </Text>
              <Text variant="labelSm" tone="textSecondary" numberOfLines={1}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
