import { ScanLine } from 'lucide-react-native';
import { View } from 'react-native';

import { stayHeadline } from '@/features/vendor/domain/listingHeadlines';
import { staySummary, stayParts, type ListingBooking } from '@/features/vendor/domain/listings';
import { SummaryRows } from '@/features/vendor/ui/SummaryRows';
import { ListingTodayFrame, type Load, type Top } from '@/features/vendor/ui/ListingTodayFrame';
import { SectionTitle } from '@/features/vendor/ui/TodayTop';

import { Button, ListRow, Text } from '@/shared/ui';

const paymentWord: Record<ListingBooking['payment'], string> = {
  paid: 'Paid',
  payAtHotel: 'Pay at hotel',
  unpaid: 'Not paid',
};

export function HotelTodayScreen({
  top,
  state,
  onCheckIn,
  onOpenBookings,
  onOpenBooking,
}: {
  top: Top;
  state: Load<ListingBooking[]>;
  /** Null until the front desk opens to hotel owners. */
  onCheckIn: (() => void) | null;
  onOpenBookings: () => void;
  onOpenBooking: (b: ListingBooking) => void;
}) {
  const list = state.status === 'ready' ? state.data : [];
  const s = staySummary(list, top.today);
  const arrivals = list
    .filter((b) => b.checkIn === top.today && b.status === 'confirmed')
    .slice(0, 5);
  return (
    <ListingTodayFrame
      top={top}
      lines={state.status === 'ready' ? stayHeadline('hotel', s) : ['Today']}
      state={state}
    >
      <SummaryRows
        rows={[
          {
            label: 'Arriving today',
            detail:
              s.arrived === 0 ? 'None checked in yet' : `${String(s.arrived)} already checked in`,
            value: String(s.arriving),
            onPress: onOpenBookings,
            testID: 'vendor-row-arriving',
          },
          {
            label: 'Leaving today',
            detail: 'Guests still in house',
            value: String(s.leaving),
            onPress: onOpenBookings,
          },
        ]}
      />
      {onCheckIn === null ? (
        <Text variant="caption" tone="textSecondary">
          Your front-desk staff check guests in from their Bookhushly app.
        </Text>
      ) : (
        <Button
          label="Check a guest in"
          icon={ScanLine}
          onPress={onCheckIn}
          testID="vendor-check-in"
        />
      )}
      <View>
        <SectionTitle title="Still to arrive" action="All bookings" onAction={onOpenBookings} />
        {arrivals.length === 0 ? (
          <Text variant="bodySm" tone="textSecondary">
            Everyone due today is in.
          </Text>
        ) : (
          arrivals.map((b) => (
            <ListRow
              key={b.id}
              title={b.guest}
              subtitle={`${b.unit} · ${stayParts(b).nights}`}
              trailing={
                <Text
                  variant="labelSm"
                  tone={b.payment === 'paid' ? 'textPrimary' : 'textSecondary'}
                >
                  {paymentWord[b.payment]}
                </Text>
              }
              onPress={() => {
                onOpenBooking(b);
              }}
            />
          ))
        )}
      </View>
    </ListingTodayFrame>
  );
}
