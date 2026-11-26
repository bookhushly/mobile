import { Clock } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { timeLeft, type OpenRequest } from '@/features/vendor/domain/today';
import { ServicePhoto } from '@/features/vendor/ui/ServicePhoto';
import { TimePill } from '@/features/vendor/ui/TimePill';
import { borderWidth, color, pressedOpacity, radius, space, vendorSize } from '@/shared/theme';
import { Text } from '@/shared/ui';

const quotesLine = (n: number) =>
  n === 0 ? 'No quotes yet' : `${String(n)} ${n === 1 ? 'quote' : 'quotes'} so far`;

type Props = {
  requests: OpenRequest[];
  nowMs: number;
  onOpen: (r: OpenRequest) => void;
  /** Bleeds to the screen edge so the next card peeks out (it scrolls). */
  gutter: number;
};

/** New requests as photo cards you swipe through, each with its time left. */
export function RequestStrip({ requests, nowMs, onOpen, gutter }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={{ paddingHorizontal: gutter, gap: space.s4 }}
    >
      {requests.slice(0, vendorSize.todayRequests).map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={`${r.title}, ${r.summary}, ${timeLeft(r.closesAt, nowMs)}, ${quotesLine(r.quotes)}`}
          onPress={() => {
            onOpen(r);
          }}
          style={({ pressed }) => ({
            opacity: pressed ? pressedOpacity : 1,
            width: vendorSize.requestCard,
            borderRadius: radius.r4,
            borderWidth: borderWidth.hairline,
            borderColor: color.border,
            overflow: 'hidden',
            backgroundColor: color.surface,
          })}
        >
          <ServicePhoto photo={r.photo} height={vendorSize.requestPhoto}>
            <TimePill icon={Clock} label={timeLeft(r.closesAt, nowMs)} />
          </ServicePhoto>
          <View style={{ padding: space.s4, gap: space.s1 }}>
            <Text variant="labelSm" numberOfLines={1}>
              {r.title}
            </Text>
            <Text variant="caption" tone="textSecondary" numberOfLines={1}>
              {r.summary}
            </Text>
            <Text variant="caption" tone="textSecondary">
              {quotesLine(r.quotes)}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
