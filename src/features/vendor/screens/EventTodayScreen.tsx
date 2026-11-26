import { Calendar, ScanLine } from 'lucide-react-native';
import { View } from 'react-native';

import { eventHeadline } from '@/features/vendor/domain/listingHeadlines';
import { nextEvent, ticketsLine, type VendorEvent } from '@/features/vendor/domain/listings';
import { SummaryRows } from '@/features/vendor/ui/SummaryRows';
import { ListingTodayFrame, type Load, type Top } from '@/features/vendor/ui/ListingTodayFrame';

import { lagosTime, lagosToday, shortDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Button, formatNaira, Icon, Text } from '@/shared/ui';

export function EventTodayScreen({
  top,
  state,
  onScan,
  onOpenEvents,
}: {
  top: Top;
  state: Load<VendorEvent[]>;
  /** Null when gate mode isn't available on this account. */
  onScan: (() => void) | null;
  onOpenEvents: () => void;
}) {
  const next = state.status === 'ready' ? nextEvent(state.data, top.nowMs) : null;
  const week = state.status === 'ready' ? state.data : [];
  const soldWeek = week.reduce((n, e) => n + e.soldThisWeek, 0);
  const salesWeek = week.reduce((n, e) => n + e.salesThisWeek, 0);
  const pct =
    next === null || next.capacity === null || next.capacity === 0
      ? null
      : Math.min(1, next.sold / next.capacity);
  return (
    <ListingTodayFrame
      top={top}
      lines={
        state.status === 'ready'
          ? eventHeadline(next?.title ?? null, next?.startsAt ?? null, top.nowMs)
          : ['Today']
      }
      state={state}
    >
      {next === null ? null : (
        <View
          testID="vendor-next-event"
          style={{
            borderWidth: borderWidth.hairline,
            borderColor: color.border,
            borderRadius: radius.r4,
            padding: space.s5,
            gap: space.s4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
            <Icon as={Calendar} size="xs" />
            <Text variant="labelSm" tabular>
              {`${shortDate(lagosToday(Date.parse(next.startsAt)))} · ${lagosTime(next.startsAt)}`}
            </Text>
          </View>
          <Text variant="caption" tone="textSecondary">
            {next.venue}
          </Text>
          <View style={{ gap: space.s2 }}>
            <Text variant="title" tabular>
              {ticketsLine(next)}
            </Text>
            {pct === null ? null : (
              <View
                accessible
                accessibilityLabel={`${String(Math.round(pct * 100))} percent sold`}
                style={{
                  flexDirection: 'row',
                  height: space.s3,
                  borderRadius: radius.rFull,
                  backgroundColor: color.border,
                  overflow: 'hidden',
                }}
              >
                <View style={{ flex: pct, backgroundColor: color.textPrimary }} />
                <View style={{ flex: 1 - pct }} />
              </View>
            )}
          </View>
          <View style={{ gap: space.s2 }}>
            {next.tickets.map((t) => (
              <View key={t.name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodySm">{t.name}</Text>
                <Text variant="bodySm" tabular>
                  {t.capacity === null
                    ? `${String(t.sold)} sold`
                    : `${String(t.sold)} / ${String(t.capacity)}`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <SummaryRows
        rows={[
          {
            label: 'Sold this week',
            detail: `${formatNaira(salesWeek)} in sales`,
            value: String(soldWeek),
            onPress: onOpenEvents,
            testID: 'vendor-row-sold',
          },
        ]}
      />
      {onScan === null ? null : (
        <Button label="Scan tickets" icon={ScanLine} onPress={onScan} testID="vendor-scan" />
      )}
    </ListingTodayFrame>
  );
}
