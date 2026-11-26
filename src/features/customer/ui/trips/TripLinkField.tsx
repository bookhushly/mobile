import { View } from 'react-native';

import type { TripServiceType } from '@/features/customer/domain/trips/trips';
import { useLinkTargets, useTripLink } from '@/features/customer/hooks/useTrips';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { space } from '@/shared/theme';
import { Text } from '@/shared/ui';

const NONE = 'none';

type Props = { userId: string; type: TripServiceType };

/**
 * The web's optional "Link to a trip": shown only when an open trip still plans this kind of
 * booking. Once it's paid, the trip shows it as booked.
 */
export function TripLinkField({ userId, type }: Props) {
  const targets = useLinkTargets(userId, type);
  const chosen = useTripLink((s) => s.chosen[type] ?? null);
  const choose = useTripLink((s) => s.choose);
  if (targets.length === 0) return null;
  const value = targets.some((t) => t.tripServiceId === chosen) && chosen !== null ? chosen : NONE;
  return (
    <View style={{ gap: space.s3 }}>
      <View style={{ gap: space.s1 }}>
        <Text variant="label" accessibilityRole="header">
          Part of a trip?
        </Text>
        <Text variant="bodySm" tone="textSecondary">
          Optional. Your trip shows it as booked once it’s paid.
        </Text>
      </View>
      <ChoiceChips
        label="Part of a trip"
        value={value}
        clearable={false}
        options={[
          { value: NONE, label: 'Not part of a trip' },
          ...targets.map((t) => ({
            value: t.tripServiceId,
            label: t.destination === null ? t.tripName : `${t.tripName} · ${t.destination}`,
          })),
        ]}
        onChange={(v) => {
          choose(type, v === null || v === NONE ? null : v);
        }}
        testID={`trip-link-${type}`}
      />
    </View>
  );
}
