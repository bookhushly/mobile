import { Pressable, View } from 'react-native';

import type { Mode } from '@/features/mode/domain/resolveMode';
import { borderWidth, color, density, radius, space } from '@/shared/theme';
import { Stack, Text } from '@/shared/ui';

const LABEL: Record<Mode, string> = {
  customer: 'Customer',
  gate: 'Gate staff',
  receptionist: 'Front desk',
};

const HINT: Record<Mode, string> = {
  customer: 'Book and see your tickets',
  gate: 'Scan tickets at the door',
  receptionist: 'Check in hotel guests',
};

type Props = { modes: Mode[]; current: Mode; onChoose: (m: Mode) => void };

export function ModeSwitcher({ modes, current, onChoose }: Props) {
  if (modes.length < 2) return null;
  return (
    <Stack gap="s3">
      <Text variant="label" tone="textSecondary">
        Mode
      </Text>
      <View accessibilityRole="radiogroup" style={{ gap: space.s3 }}>
        {modes.map((m) => {
          const checked = m === current;
          return (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityLabel={`${LABEL[m]}, ${HINT[m]}`}
              accessibilityState={{ checked }}
              onPress={() => {
                onChoose(m);
              }}
              style={{
                minHeight: density.gate.controlHeight,
                paddingHorizontal: space.s4,
                paddingVertical: space.s3,
                justifyContent: 'center',
                borderRadius: radius.r3,
                // Selected control, not a status: violet marks the active choice (DESIGN_SYSTEM §4).
                borderWidth: checked ? borderWidth.thick : borderWidth.hairline,
                borderColor: checked ? color.actionFill : color.borderStrong,
                backgroundColor: color.surface,
              }}
            >
              <Text variant="bodyStrong">{LABEL[m]}</Text>
              <Text variant="bodySm" tone="textSecondary">
                {HINT[m]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Stack>
  );
}
