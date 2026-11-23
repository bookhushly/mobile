import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import type { StepMark } from '@/features/customer/domain/carRental/carStatus';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

type Item = { title: string; line?: string | null; mark: StepMark };
type Props = { items: readonly Item[]; testID?: string };

const DOT = 24;
const RAIL = 2;

const SPOKEN: Record<StepMark, string> = { done: 'done', current: 'now', later: 'next' };

// Design 2A after Booking.com's "We're working on it": ink and grey only (owner, 2026-11-23).
// Done is a solid ink dot with a tick, now is an ink ring, later is grey; the words say it too.
export function RequestTimeline({ items, testID }: Props) {
  return (
    <View testID={testID}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const done = it.mark === 'done';
        return (
          <View
            key={it.title}
            style={{ flexDirection: 'row', gap: space.s4 }}
            accessible
            accessibilityLabel={[it.title, it.line, SPOKEN[it.mark]].filter(Boolean).join(', ')}
          >
            <View style={{ alignItems: 'center', width: DOT }}>
              <View
                style={{
                  width: DOT,
                  height: DOT,
                  borderRadius: radius.rFull,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? color.textPrimary : color.surface,
                  borderWidth: done ? 0 : borderWidth.thick,
                  borderColor: it.mark === 'current' ? color.textPrimary : color.border,
                }}
              >
                {done ? <Icon as={Check} size="xs" tone="onInverse" /> : null}
              </View>
              {last ? null : (
                <View
                  style={{
                    flex: 1,
                    width: RAIL,
                    minHeight: space.s7,
                    backgroundColor: done ? color.textPrimary : color.border,
                  }}
                />
              )}
            </View>
            <View style={{ flex: 1, gap: space.s1, paddingBottom: last ? 0 : space.s6 }}>
              <Text
                variant={it.mark === 'current' ? 'bodyStrong' : 'body'}
                tone={it.mark === 'later' ? 'textSecondary' : 'textPrimary'}
              >
                {it.title}
              </Text>
              {it.line ? (
                <Text variant="bodySm" tone="textSecondary">
                  {it.line}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
