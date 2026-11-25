import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  DURATIONS,
  GUARD_TYPES,
  MAX_GUARDS,
  type SecurityDraft,
} from '@/features/customer/domain/security/securityRequest';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { DURATION, GUARD } from '@/features/customer/ui/security/securityWords';
import { space } from '@/shared/theme';
import { Stack, Stepper, Text } from '@/shared/ui';

type Props = { draft: SecurityDraft; onChange: (p: Partial<SecurityDraft>) => void };

const DURATION_OPTIONS = DURATIONS.map((v) => ({ value: v, label: DURATION[v] }));
const GUARD_OPTIONS = GUARD_TYPES.map((v) => ({ value: v, label: GUARD[v] }));

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

// Step 4: the three team answers, all required (how long and armed or unarmed are the web form's
// own required answers, and what the guide price is quoted on).
export function TeamStep({ draft, onChange }: Props) {
  return (
    <Stack gap="s7">
      <Group title="For how long?">
        <ChoiceChips
          label="For how long?"
          value={draft.duration}
          options={DURATION_OPTIONS}
          clearable={false}
          onChange={(v) => {
            onChange({ duration: v });
          }}
          testID="security-duration"
        />
      </Group>
      <Group title="How many guards?">
        <Stepper
          label="How many guards"
          value={draft.guards}
          min={1}
          max={MAX_GUARDS}
          onChange={(n) => {
            onChange({ guards: n });
          }}
          testID="security-guards"
        />
      </Group>
      <Group title="Armed or unarmed?">
        <ChoiceChips
          label="Armed or unarmed?"
          value={draft.guardType}
          options={GUARD_OPTIONS}
          clearable={false}
          onChange={(v) => {
            onChange({ guardType: v });
          }}
          testID="security-guard-type"
        />
      </Group>
    </Stack>
  );
}
