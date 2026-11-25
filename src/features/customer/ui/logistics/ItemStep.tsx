import { View } from 'react-native';

import {
  DESCRIPTION_MAX,
  ITEM_VALUE_MAX,
  ITEM_CATEGORIES,
  ITEM_WEIGHTS,
  QUANTITY_MAX,
  type LogisticsDraft,
} from '@/features/customer/domain/logistics/logisticsRequest';
import { CharCounter } from '@/features/customer/ui/CharCounter';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { CATEGORY, WEIGHT } from '@/features/customer/ui/logistics/logisticsWords';
import { space } from '@/shared/theme';
import { Input, Stack, Stepper, Text } from '@/shared/ui';

type Props = { draft: LogisticsDraft; onChange: (p: Partial<LogisticsDraft>) => void };

const CATEGORY_OPTIONS = ITEM_CATEGORIES.map((c) => ({ value: c, label: CATEGORY[c] }));
const WEIGHT_OPTIONS = ITEM_WEIGHTS.map((w) => ({ value: w, label: WEIGHT[w] }));

// Step 5: what it is (required) first, then optional chips, the count and the care options. The
// value is asked only when they want it insured (the web reads it "for insurance purposes").
export function ItemStep({ draft, onChange }: Props) {
  const raw = draft.itemValue.replace(/[,\s₦]/g, '');
  const badValue = raw !== '' && !(Number(raw) >= 0 && Number(raw) <= ITEM_VALUE_MAX);
  return (
    <Stack gap="s7">
      <View style={{ gap: space.s2 }}>
        <Input
          label="What is it?"
          value={draft.itemDescription}
          onChangeText={(t) => {
            onChange({ itemDescription: t });
          }}
          placeholder="e.g. Two boxes of books and a desk lamp"
          multiline
          maxLength={DESCRIPTION_MAX}
          testID="logistics-item"
        />
        <CharCounter length={draft.itemDescription.length} max={DESCRIPTION_MAX} />
      </View>
      <View style={{ gap: space.s3 }}>
        <Text variant="label" accessibilityRole="header">
          Category (optional)
        </Text>
        <ChoiceChips
          label="Category"
          value={draft.itemCategory}
          options={CATEGORY_OPTIONS}
          onChange={(v) => {
            onChange({ itemCategory: v });
          }}
          testID="logistics-category"
        />
      </View>
      <View style={{ gap: space.s3 }}>
        <Text variant="label" accessibilityRole="header">
          Weight (optional)
        </Text>
        <ChoiceChips
          label="Weight"
          value={draft.itemWeight}
          options={WEIGHT_OPTIONS}
          onChange={(v) => {
            onChange({ itemWeight: v });
          }}
          testID="logistics-weight"
        />
      </View>
      <Stepper
        label="How many items"
        value={draft.quantity}
        min={1}
        max={QUANTITY_MAX}
        onChange={(n) => {
          onChange({ quantity: n });
        }}
        testID="logistics-quantity"
      />
      <View>
        <CheckRow
          label="Fragile"
          checked={draft.fragile}
          onChange={(on) => {
            onChange({ fragile: on });
          }}
          testID="logistics-fragile"
        />
        <CheckRow
          label="Perishable"
          checked={draft.perishable}
          onChange={(on) => {
            onChange({ perishable: on });
          }}
        />
        <CheckRow
          label="Needs packaging"
          checked={draft.packaging}
          onChange={(on) => {
            onChange({ packaging: on });
          }}
        />
        <CheckRow
          label="Ask for insurance"
          checked={draft.insurance}
          onChange={(on) => {
            onChange(on ? { insurance: true } : { insurance: false, itemValue: '' });
          }}
          testID="logistics-insure"
        />
      </View>
      {draft.insurance ? (
        <Input
          label="What is it worth? (₦, for insurance)"
          value={draft.itemValue}
          onChangeText={(t) => {
            onChange({ itemValue: t });
          }}
          keyboardType="number-pad"
          error={badValue ? 'Enter an amount in naira' : undefined}
          testID="logistics-value"
        />
      ) : null}
    </Stack>
  );
}
