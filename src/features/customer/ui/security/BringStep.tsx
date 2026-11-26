import { View } from 'react-native';

import { SHIFTS, type SecurityDraft } from '@/features/customer/domain/security/securityRequest';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { SHIFT } from '@/features/customer/ui/security/securityWords';
import { space } from '@/shared/theme';
import { Stack, Text } from '@/shared/ui';

type Props = { draft: SecurityDraft; onChange: (p: Partial<SecurityDraft>) => void };

const SHIFT_OPTIONS = SHIFTS.map((v) => ({ value: v, label: SHIFT[v] }));

// Step 5, optional: everything about the guards themselves in one place: when they work and what
// they come with. Background checks, uniform and radios start on, as on the web form.
export function BringStep({ draft, onChange }: Props) {
  return (
    <Stack gap="s7">
      <View style={{ gap: space.s3 }}>
        <Text variant="label" accessibilityRole="header">
          Shift
        </Text>
        <ChoiceChips
          label="Shift"
          value={draft.shift}
          options={SHIFT_OPTIONS}
          onChange={(v) => {
            onChange({ shift: v });
          }}
          testID="security-shift"
        />
      </View>
      <View>
        <CheckRow
          label="Background-checked guards"
          checked={draft.backgroundCheck}
          onChange={(on) => {
            onChange({ backgroundCheck: on });
          }}
        />
        <CheckRow
          label="In uniform"
          checked={draft.uniform}
          onChange={(on) => {
            onChange({ uniform: on });
          }}
        />
        <CheckRow
          label="With radios"
          checked={draft.radios}
          onChange={(on) => {
            onChange({ radios: on });
          }}
        />
        <CheckRow
          label="With a guard dog"
          checked={draft.canine}
          onChange={(on) => {
            onChange({ canine: on });
          }}
          testID="security-dog"
        />
        <CheckRow
          label="With a patrol vehicle"
          checked={draft.vehicle}
          onChange={(on) => {
            onChange({ vehicle: on });
          }}
        />
      </View>
    </Stack>
  );
}
