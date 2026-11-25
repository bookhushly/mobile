import { View } from 'react-native';

import type {
  LogisticsDraft,
  LogisticsStep,
  Place,
} from '@/features/customer/domain/logistics/logisticsRequest';
import { Answer } from '@/features/customer/ui/car/CheckStep';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { dateRange, timeWords } from '@/features/customer/ui/car/carWords';
import {
  LOGISTICS_VEHICLE,
  SERVICE,
  itemWords,
} from '@/features/customer/ui/logistics/logisticsWords';
import { formatNaira } from '@/shared/lib/formatNaira';
import { shortDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Input, Stack, Text } from '@/shared/ui';

type Props = {
  draft: LogisticsDraft;
  guide: { min: number; max: number } | null;
  askName: boolean;
  name: string;
  nameError: string | undefined;
  onName: (t: string) => void;
  askPhone: boolean;
  phone: string;
  phoneError: string | undefined;
  onPhone: (t: string) => void;
  onEdit: (s: LogisticsStep) => void;
};

const placeWords = (p: Place) =>
  [p.address.trim(), p.state === null ? null : stateName(p.state)]
    .filter((s): s is string => s !== null && s !== '')
    .join(', ');

// Step 7: every answer, each editable; the guide price when there is one. Nothing is charged here.
export function LogisticsCheckStep(p: Props) {
  const d = p.draft;
  const when = [
    d.pickupDate === null ? '' : shortDate(d.pickupDate),
    d.pickupTime === null ? null : timeWords(d.pickupTime),
    d.deliveryDate === null || d.pickupDate === null
      ? null
      : `arrive by ${dateRange(d.deliveryDate, null)}`,
  ]
    .filter((s): s is string => s !== null && s !== '')
    .join(' · ');
  const guideRange =
    p.guide === null
      ? null
      : p.guide.min === p.guide.max
        ? formatNaira(p.guide.min)
        : `${formatNaira(p.guide.min)}–${formatNaira(p.guide.max)}`;
  return (
    <Stack gap="s6">
      <View>
        <Answer
          label="Service"
          value={d.serviceType === null ? '' : SERVICE[d.serviceType].label}
          onEdit={() => {
            p.onEdit('service');
          }}
          testID="check-service"
        />
        <Answer
          label="From"
          value={placeWords(d.pickup)}
          onEdit={() => {
            p.onEdit('pickup');
          }}
          testID="check-from"
        />
        <Answer
          label="To"
          value={placeWords(d.dropoff)}
          onEdit={() => {
            p.onEdit('dropoff');
          }}
          testID="check-to"
        />
        <Answer
          label="When"
          value={when}
          onEdit={() => {
            p.onEdit('when');
          }}
          testID="check-when"
        />
        <Answer
          label="Item"
          value={`${d.itemDescription.trim()} · ${itemWords(d)}`}
          onEdit={() => {
            p.onEdit('item');
          }}
          testID="check-item"
        />
        <Answer
          label="Vehicle"
          value={
            d.vehicleType === null ? 'The company chooses' : LOGISTICS_VEHICLE[d.vehicleType].label
          }
          onEdit={() => {
            p.onEdit('vehicle');
          }}
          testID="check-vehicle"
        />
      </View>
      {guideRange !== null && d.pickup.state !== null && d.vehicleType !== null ? (
        <View style={{ gap: space.s1 }} testID="check-guide">
          <Text variant="bodyStrong">{`About ${guideRange}`}</Text>
          <Text variant="bodySm" tone="textSecondary">
            {`A guide from ${stateName(d.pickup.state)} companies’ ${LOGISTICS_VEHICLE[d.vehicleType].label.toLowerCase()} rates; quotes can differ.`}
          </Text>
        </View>
      ) : null}
      {p.askName ? (
        <Input
          label="Your name"
          value={p.name}
          onChangeText={p.onName}
          autoComplete="name"
          error={p.nameError}
          testID="logistics-name"
        />
      ) : null}
      {p.askPhone ? (
        <Input
          label="Phone number"
          hint="Companies use it to reach you about this delivery"
          value={p.phone}
          onChangeText={p.onPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={p.phoneError}
          testID="logistics-phone"
        />
      ) : null}
      <Text variant="bodySm" tone="textSecondary">
        Nothing is charged now. You pay only when you choose a quote.
      </Text>
    </Stack>
  );
}
