import { Pressable } from 'react-native';

import type { Mode } from '@/features/mode/domain/resolveMode';
import { color, density, radius, space } from '@/shared/theme';
import { Stack, Text } from '@/shared/ui';

const LABEL: Record<Mode, string> = {
  customer: 'Customer',
  gate: 'Gate staff',
  receptionist: 'Front desk',
};

type Props = { modes: Mode[]; current: Mode; onChoose: (m: Mode) => void };

export function ModeSwitcher({ modes, current, onChoose }: Props) {
  if (modes.length < 2) return null;
  return (
    <Stack gap="s3">
      <Text variant="label" tone="textMuted">
        Switch mode
      </Text>
      {modes.map((m) => {
        const selected = m === current;
        return (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityLabel={LABEL[m]}
            accessibilityState={{ selected }}
            onPress={() => {
              onChoose(m);
            }}
            style={{
              minHeight: density.customer.controlHeight,
              paddingHorizontal: space.s4,
              justifyContent: 'center',
              borderRadius: radius.r3,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? color.actionFill : color.borderStrong,
              backgroundColor: selected ? color.selectedWash : color.surface,
            }}
          >
            <Text variant="bodyStrong">{LABEL[m]}</Text>
          </Pressable>
        );
      })}
    </Stack>
  );
}
