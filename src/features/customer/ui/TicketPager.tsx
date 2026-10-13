import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { TicketView } from '@/features/customer/domain/tickets';
import { TicketCard } from '@/features/customer/ui/TicketCard';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { color, layout, radius, space } from '@/shared/theme';
import { IconButton, useMotionTier, useWide } from '@/shared/ui';

// DESIGN_SYSTEM ticket rules: as large as the width allows, within reason on tablets.
const QR_MAX = 360;
// Beyond this many, dots stop being countable; "Ticket n of m" on the card still says where.
const MAX_DOTS = 10;
const DOT = space.s3;

type Props = {
  tickets: readonly TicketView[];
  liveOnly: boolean;
  today: IsoDate;
  /** First page shown (already validated). */
  start: number;
};

// C11: one ticket per page, swiped or stepped; only the page on screen polls (C7).
export function TicketPager({ tickets, liveOnly, today, start }: Props) {
  const { width } = useWindowDimensions();
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  const tier = useMotionTier();
  const list = useRef<FlatList<TicketView>>(null);
  const [index, setIndex] = useState(start);
  const last = tickets.length - 1;
  const current = Math.max(0, Math.min(index, last));
  const qrSize = Math.min(width - gutter * 2, QR_MAX);

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(i, last)));
  };
  const go = (i: number) => {
    // Reduce Motion: jump, no pager animation (spec §6).
    list.current?.scrollToOffset({ offset: i * width, animated: tier !== 'none' });
    setIndex(i);
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        testID="ticket-pager"
        data={tickets}
        keyExtractor={(t) => t.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        initialScrollIndex={start > 0 && start <= last ? start : undefined}
        onMomentumScrollEnd={onSettle}
        extraData={current}
        renderItem={({ item, index: i }) => (
          <ScrollView
            style={{ width }}
            contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: space.s5 }}
          >
            <TicketCard
              ticket={item}
              active={i === current}
              liveOnly={liveOnly}
              qrSize={qrSize}
              today={today}
            />
          </ScrollView>
        )}
      />
      {tickets.length > 1 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: gutter,
            paddingVertical: space.s3,
          }}
        >
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Previous ticket"
            disabled={current === 0}
            onPress={() => {
              go(current - 1);
            }}
          />
          {tickets.length <= MAX_DOTS ? (
            <View
              testID="ticket-dots"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ flexDirection: 'row', gap: space.s3 }}
            >
              {tickets.map((t, i) => (
                <View
                  key={t.id}
                  style={{
                    width: DOT,
                    height: DOT,
                    borderRadius: radius.rFull,
                    backgroundColor: i === current ? color.actionFill : color.border,
                  }}
                />
              ))}
            </View>
          ) : null}
          <IconButton
            icon={ChevronRight}
            accessibilityLabel="Next ticket"
            disabled={current === last}
            onPress={() => {
              go(current + 1);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
