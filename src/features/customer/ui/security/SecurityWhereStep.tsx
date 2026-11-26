import { useState } from 'react';

import type { SecurityDraft } from '@/features/customer/domain/security/securityRequest';
import { StateSheet } from '@/features/customer/ui/car/StateSheet';
import { StateField } from '@/features/customer/ui/car/WhereStep';
import { Input, Stack, Text } from '@/shared/ui';

type Props = { draft: SecurityDraft; onChange: (p: Partial<SecurityDraft>) => void };

// Step 2: where the guards are needed. A typed address, a landmark, the state from the list (it
// decides which companies are asked).
export function SecurityWhereStep({ draft, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  const personal = draft.service === 'personal_security' || draft.service === 'escort';
  return (
    <Stack gap="s6">
      <Input
        label={personal ? 'Where they meet you' : 'Address'}
        value={draft.address}
        onChangeText={(t) => {
          onChange({ address: t });
        }}
        placeholder="e.g. 7 Bourdillon Road, Ikoyi"
        autoCapitalize="words"
        maxLength={500}
        testID="security-address"
      />
      <Input
        label="Landmark (optional)"
        value={draft.landmark}
        onChangeText={(t) => {
          onChange({ landmark: t });
        }}
        placeholder="e.g. Opposite the police post"
        maxLength={200}
        testID="security-landmark"
      />
      <StateField
        label="State"
        value={draft.state}
        onPress={() => {
          setPicking(true);
        }}
        testID="security-state"
      />
      <Text variant="bodySm" tone="textSecondary">
        The state decides which companies are asked.
      </Text>
      <StateSheet
        visible={picking}
        title="State"
        value={draft.state}
        onPick={(s) => {
          onChange({ state: s });
          setPicking(false);
        }}
        onClose={() => {
          setPicking(false);
        }}
      />
    </Stack>
  );
}
