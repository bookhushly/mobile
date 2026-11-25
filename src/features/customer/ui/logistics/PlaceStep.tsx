import { useState } from 'react';

import type { LogisticsDraft, Place } from '@/features/customer/domain/logistics/logisticsRequest';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { StateSheet } from '@/features/customer/ui/car/StateSheet';
import { StateField } from '@/features/customer/ui/car/WhereStep';
import { Input, Stack, Text } from '@/shared/ui';

type Props = {
  draft: LogisticsDraft;
  end: 'pickup' | 'dropoff';
  onChange: (p: Partial<LogisticsDraft>) => void;
};

// Steps 2 and 3: the same screen twice. A typed address, the landmark people actually give
// directions by, and the state from the list (it decides which companies are asked). Places from
// Google wait for the owner's Cloud setup.
export function PlaceStep({ draft, end, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  const place = end === 'pickup' ? draft.pickup : draft.dropoff;
  const set = (p: Partial<Place>) => {
    const next = { ...place, ...p };
    onChange(end === 'pickup' ? { pickup: next } : { dropoff: next });
  };
  const sameState =
    end === 'dropoff' && draft.pickup.state !== null && place.state === draft.pickup.state;
  return (
    <Stack gap="s6">
      <Input
        label="Street address"
        value={place.address}
        onChangeText={(t) => {
          set({ address: t });
        }}
        placeholder={
          end === 'pickup' ? 'e.g. 12 Allen Avenue, Ikeja' : 'e.g. 4 Aminu Kano Crescent, Wuse 2'
        }
        autoCapitalize="words"
        maxLength={500}
        testID={`logistics-${end}-address`}
      />
      <Input
        label="Landmark (optional)"
        value={place.landmark}
        onChangeText={(t) => {
          set({ landmark: t });
        }}
        placeholder="e.g. Beside First Bank"
        autoCapitalize="sentences"
        maxLength={200}
        testID={`logistics-${end}-landmark`}
      />
      <StateField
        label="State"
        value={place.state}
        onPress={() => {
          setPicking(true);
        }}
        testID={`logistics-${end}-state`}
      />
      {end === 'dropoff' && draft.pickup.state !== null ? (
        <CheckRow
          label="Same state as pick-up"
          checked={sameState}
          onChange={(on) => {
            set({ state: on ? draft.pickup.state : null });
          }}
          testID="logistics-same-state"
        />
      ) : null}
      {end === 'pickup' ? (
        <Text variant="bodySm" tone="textSecondary">
          The state decides which companies are asked.
        </Text>
      ) : null}
      <StateSheet
        visible={picking}
        title={end === 'pickup' ? 'Pick-up state' : 'Drop-off state'}
        value={place.state}
        onPick={(s) => {
          set({ state: s });
          setPicking(false);
        }}
        onClose={() => {
          setPicking(false);
        }}
      />
    </Stack>
  );
}
