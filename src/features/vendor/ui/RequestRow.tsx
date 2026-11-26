import { ChevronRight, Clock } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { offerLine, type VendorRequest } from '@/features/vendor/domain/requests';
import { timeLeft } from '@/features/vendor/domain/today';
import { ServicePhoto } from '@/features/vendor/ui/ServicePhoto';
import { borderWidth, color, pressedOpacity, radius, space, vendorSize } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

const DAY = 86_400_000;

const quotesWord = (n: number) =>
  n === 0 ? 'no quotes yet' : `${String(n)} ${n === 1 ? 'quote' : 'quotes'}`;

type Props = { request: VendorRequest; nowMs: number; onPress: () => void };

/** One request in a list: what was asked (photo), where and when, then time left or your quote. */
export function RequestRow({ request: r, nowMs, onPress }: Props) {
  const left = timeLeft(r.closesAt, nowMs);
  const urgent = Date.parse(r.closesAt) - nowMs < DAY;
  const status =
    r.myOffer === null || r.myOffer.status === 'withdrawn'
      ? `${left} · ${quotesWord(r.quotes)}`
      : offerLine(r.myOffer);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.title}, ${r.summary}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        paddingVertical: space.s4,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
        opacity: pressed ? pressedOpacity : 1,
      })}
    >
      <View style={{ width: vendorSize.rowPhoto, borderRadius: radius.r3, overflow: 'hidden' }}>
        <ServicePhoto photo={r.photo} height={vendorSize.rowPhoto} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space.s1 }}>
        <Text variant="label" numberOfLines={1}>
          {r.title}
        </Text>
        <Text variant="caption" tone="textSecondary" numberOfLines={1}>
          {r.summary}
        </Text>
        {r.myOffer === null || r.myOffer.status === 'withdrawn' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
            <Icon as={Clock} size="xs" tone={urgent ? 'textPrimary' : 'textSecondary'} />
            <Text
              variant={urgent ? 'labelSm' : 'caption'}
              tone={urgent ? 'textPrimary' : 'textSecondary'}
              tabular
              numberOfLines={1}
            >
              {status}
            </Text>
          </View>
        ) : (
          <Text variant="labelSm" numberOfLines={2}>
            {status}
          </Text>
        )}
      </View>
      <Icon as={ChevronRight} size="sm" tone="textMuted" />
    </Pressable>
  );
}
