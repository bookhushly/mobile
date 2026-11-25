import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { CarDraft } from '@/features/customer/domain/carRental/carRequest';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { StateSheet, stateName } from '@/features/customer/ui/car/StateSheet';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Input, Stack, Text, useDensity } from '@/shared/ui';

type Props = { draft: CarDraft; onChange: (p: Partial<CarDraft>) => void };

export { stateName } from '@/features/customer/ui/car/StateSheet';

export function StateField({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
  testID?: string;
}) {
  const d = useDensity();
  return (
    <View style={{ gap: space.s2 }}>
      <Text variant="fieldLabel">{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value === null ? 'not chosen' : stateName(value)}`}
        onPress={onPress}
        style={{
          minHeight: d.controlHeight,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: space.s5,
          borderRadius: radius.r3,
          borderWidth: borderWidth.hairline,
          borderColor: color.borderStrong,
          backgroundColor: color.surface,
        }}
      >
        <Text
          variant="body"
          tone={value === null ? 'textSecondary' : 'textPrimary'}
          style={{ flex: 1 }}
        >
          {value === null ? 'Choose a state' : stateName(value)}
        </Text>
        <Icon as={ChevronDown} size="md" />
      </Pressable>
    </View>
  );
}

// Step 1. Places from Google wait for the owner's Cloud setup (postponed 2026-11-23): until then a
// typed meeting point, and the state from the list (it decides which companies are asked).
export function WhereStep({ draft, onChange }: Props) {
  const [picking, setPicking] = useState<'pickup' | 'end' | null>(null);
  const going = draft.destination !== null;
  return (
    <Stack gap="s6">
      <Input
        label="Meeting point"
        hint="A street, hotel or landmark the driver can find"
        value={draft.pickupAddress}
        onChangeText={(t) => {
          onChange({ pickupAddress: t });
        }}
        placeholder="e.g. Allen Avenue, Ikeja"
        autoCapitalize="words"
        maxLength={500}
        testID="car-pickup-address"
      />
      <StateField
        label="State"
        value={draft.pickupState}
        onPress={() => {
          setPicking('pickup');
        }}
        testID="car-pickup-state"
      />
      <CheckRow
        label="Going to another state?"
        checked={going}
        onChange={(on) => {
          onChange({ destination: on ? { state: null, address: '' } : null });
        }}
        testID="car-going-away"
      />
      {draft.destination === null ? null : (
        <Stack gap="s5">
          <StateField
            label="Where the trip ends"
            value={draft.destination.state}
            onPress={() => {
              setPicking('end');
            }}
            testID="car-end-state"
          />
          <Input
            label="Town or address (optional)"
            value={draft.destination.address}
            onChangeText={(t) => {
              onChange({ destination: { state: draft.destination?.state ?? null, address: t } });
            }}
            placeholder="e.g. Abeokuta"
            autoCapitalize="words"
            maxLength={500}
          />
        </Stack>
      )}
      <StateSheet
        visible={picking !== null}
        title={picking === 'end' ? 'Where the trip ends' : 'Pick-up state'}
        value={picking === 'end' ? (draft.destination?.state ?? null) : draft.pickupState}
        onPick={(s) => {
          if (picking === 'end')
            onChange({ destination: { state: s, address: draft.destination?.address ?? '' } });
          else onChange({ pickupState: s });
          setPicking(null);
        }}
        onClose={() => {
          setPicking(null);
        }}
      />
    </Stack>
  );
}
