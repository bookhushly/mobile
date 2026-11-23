import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  NOTES_MAX,
  PRICING_MODELS,
  PURPOSES,
  usesDuration,
  type CarDraft,
} from '@/features/customer/domain/carRental/carRequest';
import { CharCounter } from '@/features/customer/ui/CharCounter';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { PRICING, PURPOSE } from '@/features/customer/ui/car/carWords';
import { space } from '@/shared/theme';
import { Input, Stack, Text } from '@/shared/ui';

type Props = { draft: CarDraft; onChange: (p: Partial<CarDraft>) => void };

const PRICING_OPTIONS = PRICING_MODELS.map((m) => ({ value: m, label: PRICING[m] }));
const PURPOSE_OPTIONS = PURPOSES.map((p) => ({ value: p, label: PURPOSE[p] }));

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.s3 }}>
      <Text variant="label" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

// Step 5, all optional: abstract choices stay chips. Hourly and per-km quotes need a number the
// web form also asks for.
export function DetailsStep({ draft, onChange }: Props) {
  const m = draft.pricingModel;
  const raw = draft.durationValue.trim();
  const bad = raw !== '' && !(Number(raw) > 0);
  return (
    <Stack gap="s7">
      <Group title="How should they price it?">
        <ChoiceChips
          label="How should they price it?"
          value={m}
          options={PRICING_OPTIONS}
          onChange={(v) => {
            onChange({ pricingModel: v });
          }}
          testID="car-pricing"
        />
        {usesDuration(m) ? (
          <Input
            label={m === 'hourly' ? 'About how many hours?' : 'About how many km?'}
            value={draft.durationValue}
            onChangeText={(t) => {
              onChange({ durationValue: t });
            }}
            keyboardType="decimal-pad"
            error={bad ? 'Enter a number above 0' : undefined}
            testID="car-duration"
          />
        ) : null}
      </Group>
      <Group title="What’s it for?">
        <ChoiceChips
          label="What’s it for?"
          value={draft.purpose}
          options={PURPOSE_OPTIONS}
          onChange={(v) => {
            onChange({ purpose: v });
          }}
          testID="car-purpose"
        />
      </Group>
      <View style={{ gap: space.s2 }}>
        <Input
          label="Anything else?"
          value={draft.notes}
          onChangeText={(t) => {
            onChange({ notes: t });
          }}
          placeholder="Child seat, non-smoking car…"
          multiline
          maxLength={NOTES_MAX}
          testID="car-notes"
        />
        <CharCounter length={draft.notes.length} max={NOTES_MAX} />
      </View>
    </Stack>
  );
}
