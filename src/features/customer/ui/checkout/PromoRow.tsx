import { useState } from 'react';
import { View } from 'react-native';

import type { PromoState } from '@/features/customer/hooks/usePromo';
import { space } from '@/shared/theme';
import { Button, formatNaira, Input, Stack, Text, TextLink } from '@/shared/ui';

type Props = {
  state: PromoState;
  /** The applied code was previewed for another total: it must be applied again. */
  stale: boolean;
  /** Null while there is nothing to discount yet (no dates or no tickets). */
  amount: number | null;
  onApply: (code: string) => void;
  onRemove: () => void;
};

const CODE_MAX = 40;

// Spec P9: "Add a promo code" opens a field; a valid code reads "−₦X", an invalid one the
// server's words. The server re-checks it at create.
export function PromoRow({ state, stale, amount, onApply, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');

  if (state.phase === 'applied' && !stale) {
    return (
      <View
        testID="promo-applied"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}
      >
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="bodyStrong">{state.promo.code}</Text>
          <Text variant="bodySm" tone="successFg" tabular>
            {`−${formatNaira(state.promo.discount)}`}
          </Text>
        </View>
        <Button variant="ghost" label="Remove" onPress={onRemove} testID="promo-remove" />
      </View>
    );
  }

  if (!open && state.phase !== 'applied') {
    return (
      <TextLink
        label="Add a promo code"
        onPress={() => {
          setOpen(true);
        }}
        testID="promo-open"
      />
    );
  }

  const error =
    state.phase === 'invalid' || state.phase === 'error'
      ? state.words
      : stale
        ? 'Your total changed. Apply the code again'
        : undefined;
  return (
    <Stack gap="s3">
      <Input
        label="Promo code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CODE_MAX}
        error={error}
        hint={amount === null ? 'Choose your booking first' : undefined}
        testID="promo-input"
      />
      <Button
        variant="secondary"
        label="Apply"
        loading={state.phase === 'checking'}
        disabled={amount === null || code.trim() === ''}
        onPress={() => {
          onApply(code);
        }}
        testID="promo-apply"
      />
    </Stack>
  );
}
