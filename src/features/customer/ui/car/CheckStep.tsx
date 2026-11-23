import { Pressable, View } from 'react-native';

import {
  tripDays,
  type CarDraft,
  type Step,
} from '@/features/customer/domain/carRental/carRequest';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { stateName } from '@/features/customer/ui/car/WhereStep';
import {
  PRICING,
  PURPOSE,
  TRIP,
  VEHICLE,
  dateRange,
  daysWords,
  guideWords,
  peopleWords,
  timeWords,
} from '@/features/customer/ui/car/carWords';
import { borderWidth, color, space } from '@/shared/theme';
import { Input, Stack, Text, useDensity } from '@/shared/ui';

type Props = {
  draft: CarDraft;
  guide: { min: number; max: number } | null;
  /** Shown when the account has no phone number (the request needs one). */
  askPhone: boolean;
  phone: string;
  phoneError: string | undefined;
  onPhone: (t: string) => void;
  /** Shown when the account has no name (the request needs one). */
  askName: boolean;
  name: string;
  nameError: string | undefined;
  onName: (t: string) => void;
  onChange: (p: Partial<CarDraft>) => void;
  onEdit: (s: Step) => void;
};

function Answer({
  label,
  value,
  onEdit,
  testID,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  testID: string;
}) {
  const d = useDensity();
  return (
    <View
      style={{
        minHeight: d.rowMin,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s4,
        paddingVertical: space.s4,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
      }}
    >
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="caption" tone="textSecondary">
          {label}
        </Text>
        <Text variant="body" testID={testID}>
          {value}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label.toLowerCase()}`}
        onPress={onEdit}
        hitSlop={space.s3}
        style={{ minHeight: d.minTarget, justifyContent: 'center' }}
      >
        <Text variant="label" tone="linkText" style={{ textDecorationLine: 'underline' }}>
          Edit
        </Text>
      </Pressable>
    </View>
  );
}

// Step 6: every answer, each editable; the guide price; urgent. Nothing is charged here.
export function CheckStep({
  draft,
  guide,
  askPhone,
  phone,
  phoneError,
  onPhone,
  onChange,
  onEdit,
  askName,
  name,
  nameError,
  onName,
}: Props) {
  const where = [
    draft.pickupAddress.trim(),
    draft.pickupState === null ? null : stateName(draft.pickupState),
  ]
    .filter((s): s is string => s !== null && s !== '')
    .join(', ');
  const end = draft.destination?.state ?? null;
  const days = tripDays(draft);
  const when = [
    draft.pickupDate === null ? '' : dateRange(draft.pickupDate, draft.returnDate),
    draft.pickupTime === null ? null : timeWords(draft.pickupTime),
    daysWords(days),
  ]
    .filter((s): s is string => s !== null && s !== '')
    .join(' · ');
  const how = [
    draft.tripType === null ? null : TRIP[draft.tripType].label,
    peopleWords(draft.passengers),
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
  const car = draft.vehicleType === null ? 'Any car' : VEHICLE[draft.vehicleType].label;
  const extras = [
    draft.pricingModel === null ? null : PRICING[draft.pricingModel],
    draft.purpose === null ? null : PURPOSE[draft.purpose],
    draft.notes.trim() === '' ? null : 'Note added',
  ].filter((s): s is string => s !== null);
  return (
    <Stack gap="s6">
      <View>
        <Answer
          label="Where"
          value={end === null ? where : `${where} → ${stateName(end)}`}
          onEdit={() => {
            onEdit('where');
          }}
          testID="check-where"
        />
        <Answer
          label="When"
          value={when}
          onEdit={() => {
            onEdit('when');
          }}
          testID="check-when"
        />
        <Answer
          label="How"
          value={how}
          onEdit={() => {
            onEdit('how');
          }}
          testID="check-how"
        />
        <Answer
          label="Car"
          value={car}
          onEdit={() => {
            onEdit('car');
          }}
          testID="check-car"
        />
        <Answer
          label="Details"
          value={extras.length === 0 ? 'None added' : extras.join(' · ')}
          onEdit={() => {
            onEdit('details');
          }}
          testID="check-details"
        />
      </View>
      {guide !== null && draft.pricingModel !== null && draft.pickupState !== null ? (
        <View style={{ gap: space.s1 }} testID="check-guide">
          <Text variant="bodyStrong">{guideWords(guide, draft.pricingModel)}</Text>
          <Text variant="bodySm" tone="textSecondary">
            {`A guide from ${stateName(draft.pickupState)} companies’ rates; quotes can differ.`}
          </Text>
        </View>
      ) : null}
      {askName ? (
        <Input
          label="Your name"
          value={name}
          onChangeText={onName}
          autoComplete="name"
          error={nameError}
          testID="car-name"
        />
      ) : null}
      {askPhone ? (
        <Input
          label="Phone number"
          hint="Companies use it to reach you about this trip"
          value={phone}
          onChangeText={onPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={phoneError}
          testID="car-phone"
        />
      ) : null}
      <View>
        <CheckRow
          label="Need it within 24 hours?"
          checked={draft.urgent}
          onChange={(on) => {
            onChange({ urgent: on });
          }}
          testID="car-urgent"
        />
        <Text variant="bodySm" tone="textSecondary" style={{ paddingTop: space.s2 }}>
          Urgent requests are open to quotes for 24 hours instead of 72.
        </Text>
      </View>
      <Text variant="bodySm" tone="textSecondary">
        Nothing is charged now. You pay only when you choose a quote.
      </Text>
    </Stack>
  );
}
