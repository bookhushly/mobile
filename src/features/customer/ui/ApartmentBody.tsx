import { View } from 'react-native';

import type { ApartmentListing } from '@/features/customer/api/listingDetailDb';
import { nightsLabel } from '@/features/customer/domain/detailText';
import { apartmentFacts, pricingRuleLine } from '@/features/customer/domain/listingDetail';
import { clockLabel } from '@/features/customer/domain/myBookings';
import { plainText } from '@/features/customer/domain/plainText';
import { AmenityList } from '@/features/customer/ui/AmenityList';
import { DetailRows, type DetailRow } from '@/features/customer/ui/DetailRows';
import { DetailSection } from '@/features/customer/ui/DetailSection';
import { FactsGrid } from '@/features/customer/ui/FactsGrid';
import { ReadMoreText } from '@/features/customer/ui/ReadMoreText';
import { space } from '@/shared/theme';
import { formatNaira, Text } from '@/shared/ui';

type Props = { listing: ApartmentListing; onShowAmenities: () => void };

const at = (word: string, t: string | null) => {
  const c = clockLabel(t);
  return c === null ? '' : `${word} ${c}`;
};
const priced = (label: string, n: number | null, unit: string): DetailRow | null =>
  n !== null && n > 0 ? { label, value: unit, amount: n } : null;

// Spec §3 apartment, D5: key facts, prices (night/week/month, seasonal rules), minimum stay,
// caution deposit (amount only), amenities, house rules, times, cancellation.
export function ApartmentBody({ listing, onShowAmenities }: Props) {
  const { apartment: a, rules } = listing;
  const seasonal = rules.map(pricingRuleLine).filter((r) => r !== null);
  const stay = a.minimum_stay !== null && a.minimum_stay > 1 ? Math.floor(a.minimum_stay) : null;
  const houseRules = plainText(a.house_rules);
  const cancellation = plainText(a.cancellation_policy);
  return (
    <>
      <FactsGrid facts={apartmentFacts(a)} testID="facts" />
      <DetailSection label="Prices" testID="prices">
        <DetailRows
          rows={[
            priced('Per night', a.price_per_night, 'per night'),
            priced('Per week', a.price_per_week, 'per week'),
            priced('Per month', a.price_per_month, 'per month'),
            stay === null ? null : { label: 'Minimum stay', value: nightsLabel(stay) },
            a.caution_deposit !== null && a.caution_deposit > 0
              ? { label: 'Caution deposit', value: formatNaira(a.caution_deposit) }
              : null,
          ]}
        />
        {seasonal.length > 0 ? (
          <View style={{ gap: space.s2, paddingTop: space.s3 }} testID="pricing-rules">
            <Text variant="label">Prices vary by date</Text>
            {seasonal.map((r) => (
              <Text
                key={r.id}
                variant="bodySm"
                tone="textSecondary"
              >{`${r.label}: ${formatNaira(r.amount)} per night`}</Text>
            ))}
          </View>
        ) : null}
      </DetailSection>
      {a.amenities.length > 0 ? (
        <DetailSection label="Amenities">
          <AmenityList amenities={a.amenities} onShowAll={onShowAmenities} testID="amenities" />
        </DetailSection>
      ) : null}
      {a.security_features.length > 0 ? (
        <DetailSection label="Security">
          <AmenityList amenities={a.security_features} />
        </DetailSection>
      ) : null}
      <DetailRows
        rows={[
          { label: 'Check-in', value: at('From', a.check_in_time) },
          { label: 'Check-out', value: at('By', a.check_out_time) },
        ]}
      />
      {houseRules !== null ? (
        <DetailSection label="House rules">
          <ReadMoreText text={houseRules} />
        </DetailSection>
      ) : null}
      {cancellation !== null ? (
        <DetailSection label="Cancellation">
          <ReadMoreText text={cancellation} />
        </DetailSection>
      ) : null}
    </>
  );
}
