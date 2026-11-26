import { View } from 'react-native';

import { color, radius, space } from '@/shared/theme';
import { Text } from '@/shared/ui';

/** A job's steps as a bar in ink and grey, with each step named under its part (design v13). */
export function JobProgress({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <View
      style={{ gap: space.s2 }}
      accessible
      accessibilityLabel={`Progress: ${steps.map((p) => `${p.label} ${p.done ? 'done' : 'to do'}`).join(', ')}`}
    >
      <View style={{ flexDirection: 'row', gap: space.s2 }}>
        {steps.map((p) => (
          <View
            key={p.label}
            style={{
              flex: 1,
              height: space.s2,
              borderRadius: radius.rFull,
              backgroundColor: p.done ? color.textPrimary : color.border,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.s2 }}>
        {steps.map((p) => (
          <Text
            key={p.label}
            variant={p.done ? 'labelSm' : 'caption'}
            tone={p.done ? 'textPrimary' : 'textSecondary'}
            maxScale={1.3}
            numberOfLines={2}
            style={{ flex: 1 }}
          >
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
