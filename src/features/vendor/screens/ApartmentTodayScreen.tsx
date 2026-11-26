import { View } from 'react-native';

import type { StayProblem } from '@/features/vendor/hooks/useListings';

import { stayHeadline } from '@/features/vendor/domain/listingHeadlines';
import {
  stayParts,
  splitBookings,
  staySummary,
  type ListingBooking,
} from '@/features/vendor/domain/listings';
import { SummaryRows } from '@/features/vendor/ui/SummaryRows';
import { ListingTodayFrame, type Load, type Top } from '@/features/vendor/ui/ListingTodayFrame';
import { SectionTitle } from '@/features/vendor/ui/TodayTop';
import { shortDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Banner, Button, formatNaira, Text } from '@/shared/ui';

function DateBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: space.s4, gap: space.s1 }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Text variant="label">{value}</Text>
    </View>
  );
}

export function ApartmentTodayScreen({
  top,
  state,
  busyId,
  problem,
  onAnswer,
  onOpenBookings,
}: {
  top: Top;
  state: Load<ListingBooking[]>;
  /** The booking being confirmed. */
  busyId: string | null;
  problem: StayProblem | null;
  onAnswer: (b: ListingBooking, confirm: boolean) => void;
  onOpenBookings: () => void;
}) {
  const list = state.status === 'ready' ? state.data : [];
  const s = staySummary(list, top.today);
  const waiting = splitBookings(list, top.today).toConfirm[0] ?? null;
  return (
    <ListingTodayFrame
      top={top}
      lines={state.status === 'ready' ? stayHeadline('apartment', s) : ['Today']}
      state={state}
    >
      {problem === null ? null : (
        <Banner
          tone={problem.transient ? 'neutral' : 'warning'}
          title={problem.title}
          message={problem.message}
        />
      )}
      {waiting === null ? null : (
        <View style={{ gap: space.s4 }}>
          <SectionTitle
            title="Waiting for you"
            action={s.toConfirm > 1 ? `All ${String(s.toConfirm)}` : undefined}
            onAction={onOpenBookings}
          />
          <View
            testID="vendor-to-confirm"
            style={{
              borderWidth: borderWidth.hairline,
              borderColor: color.border,
              borderRadius: radius.r4,
              padding: space.s5,
              gap: space.s4,
            }}
          >
            <View style={{ flexDirection: 'row', gap: space.s3, alignItems: 'baseline' }}>
              <Text variant="label" style={{ flex: 1 }}>
                {waiting.unit}
              </Text>
              <Text variant="label" tabular>
                {formatNaira(waiting.total)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                borderWidth: borderWidth.hairline,
                borderColor: color.border,
                borderRadius: radius.r3,
              }}
            >
              <DateBox label="Check-in" value={shortDate(waiting.checkIn)} />
              <View style={{ width: borderWidth.hairline, backgroundColor: color.border }} />
              <DateBox label="Check-out" value={shortDate(waiting.checkOut)} />
            </View>
            <Text variant="bodySm">
              {`${waiting.guest} · ${stayParts(waiting).nights} · ${stayParts(waiting).guests}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.s3 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Decline"
                  variant="secondary"
                  disabled={busyId !== null}
                  onPress={() => {
                    onAnswer(waiting, false);
                  }}
                  testID="vendor-decline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Confirm"
                  loading={busyId === waiting.id}
                  disabled={busyId !== null && busyId !== waiting.id}
                  onPress={() => {
                    onAnswer(waiting, true);
                  }}
                  testID="vendor-confirm"
                />
              </View>
            </View>
          </View>
        </View>
      )}
      <SummaryRows
        rows={[
          {
            label: 'Checking in today',
            detail:
              list.find((b) => b.checkIn === top.today && b.status === 'confirmed')?.unit ??
              'None today',
            value: String(s.arriving - s.arrived),
            onPress: onOpenBookings,
          },
          {
            label: 'Checking out today',
            detail:
              list.find((b) => b.checkOut === top.today && b.status === 'checked_in')?.unit ??
              'None today',
            value: String(s.leaving),
            onPress: onOpenBookings,
          },
        ]}
      />
      {waiting === null && list.length > 0 ? (
        <Button label="All bookings" variant="secondary" onPress={onOpenBookings} />
      ) : null}
    </ListingTodayFrame>
  );
}
