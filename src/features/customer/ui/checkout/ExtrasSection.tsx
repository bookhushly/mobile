import { View } from 'react-native';

import type { ApartmentExtras, HotelExtras } from '@/features/customer/api/checkoutDb';
import type { StaySelection } from '@/features/customer/domain/checkout/selection';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { space } from '@/shared/theme';
import { formatNaira, ListRow, SegmentedControl, Stack, Stepper, Text } from '@/shared/ui';

/** What the stay offers, already filtered by the P10 rules. */
export type StayExtras = {
  breakfast: { id: string; name: string; pricePerPerson: number }[];
  /** null: no transfer offered. `prices` empty: the hotel's flat fee, no airport choice. */
  airport: { prices: Record<string, number>; fee: number | null } | null;
};

/** P10: what the hotel or apartment row offers, as the form shows it. */
export function stayExtras(
  hotel: HotelExtras | undefined,
  apartment: ApartmentExtras | undefined,
): StayExtras {
  if (hotel !== undefined) {
    return {
      breakfast: hotel.breakfastOffered === 'paid' ? hotel.breakfast : [],
      airport: hotel.airportEnabled ? { prices: hotel.airportPrices, fee: hotel.airportFee } : null,
    };
  }
  // Apartments price only listed airports, with no flat fee.
  const priced =
    apartment !== undefined &&
    apartment.airportEnabled &&
    Object.keys(apartment.airportPrices).length > 0;
  return {
    breakfast: [],
    airport: priced ? { prices: apartment.airportPrices, fee: null } : null,
  };
}

type Airport = StaySelection['airport'];

type Props = {
  extras: StayExtras;
  guests: number;
  breakfast: Record<string, number>;
  airport: Airport;
  onBreakfast: (b: Record<string, number>) => void;
  onAirport: (a: Airport) => void;
};

const TRANSFER_TYPES = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'dropoff', label: 'Drop-off' },
  { value: 'both', label: 'Both' },
] as const;

// Spec P10: breakfast with a quantity per option (0–guests); airport transfer as a switch with
// Pickup / Drop-off / Both and, when priced, the airport. The server prices both.
export function ExtrasSection({
  extras,
  guests,
  breakfast,
  airport,
  onBreakfast,
  onAirport,
}: Props) {
  const codes = Object.keys(extras.airport?.prices ?? {});
  if (extras.breakfast.length === 0 && extras.airport === null) return null;
  const flatFee = extras.airport?.fee ?? null;
  const switchLabel =
    codes.length === 0 && flatFee !== null && flatFee > 0
      ? `Airport transfer · ${formatNaira(flatFee)}`
      : 'Airport transfer';
  return (
    <Stack gap="s4" testID="extras">
      <Text variant="headline">Extras</Text>
      {extras.breakfast.map((b) => (
        <View
          key={b.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}
          testID={`breakfast-${b.id}`}
        >
          <View style={{ flex: 1, gap: space.s1 }}>
            <Text variant="bodyStrong">{b.name}</Text>
            <Text variant="bodySm" tone="textSecondary" tabular>
              {`${formatNaira(b.pricePerPerson)} per person`}
            </Text>
          </View>
          <Stepper
            label={b.name}
            value={Math.min(breakfast[b.id] ?? 0, guests)}
            min={0}
            max={guests}
            onChange={(n) => {
              onBreakfast({ ...breakfast, [b.id]: n });
            }}
          />
        </View>
      ))}
      {extras.airport !== null ? (
        <CheckRow
          label={switchLabel}
          checked={airport.on}
          onChange={(on) => {
            onAirport({ ...airport, on, code: on ? (airport.code ?? codes[0] ?? null) : null });
          }}
          testID="airport-switch"
        />
      ) : null}
      {extras.airport !== null && airport.on ? (
        <>
          <SegmentedControl
            value={airport.type}
            options={TRANSFER_TYPES}
            onChange={(type) => {
              onAirport({ ...airport, type });
            }}
            testID="airport-type"
          />
          {codes.map((code) => (
            <ListRow
              key={code}
              title={code}
              subtitle={formatNaira(extras.airport?.prices[code] ?? 0)}
              checked={airport.code === code}
              onPress={() => {
                onAirport({ ...airport, code });
              }}
              testID={`airport-${code}`}
            />
          ))}
        </>
      ) : null}
    </Stack>
  );
}
