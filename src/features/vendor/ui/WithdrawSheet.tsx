import { useState } from 'react';
import { View } from 'react-native';

import { bankLabel, withdrawProblem } from '@/features/vendor/domain/earnings';
import type { WithdrawProblem } from '@/features/vendor/hooks/useEarnings';
import { space } from '@/shared/theme';
import { Banner, Button, formatNaira, Input, Sheet, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  available: number;
  bank: { name: string; last2: string };
  busy: boolean;
  problem: WithdrawProblem | null;
  /** The amount just requested; the sheet then says what happens next. */
  done: number | null;
  onWithdraw: (amount: number) => void;
  onClose: () => void;
};

/** Ask for money out to the bank on file. Bookhushly checks each withdrawal before sending it. */
export function WithdrawSheet({
  visible,
  available,
  bank,
  busy,
  problem,
  done,
  onWithdraw,
  onClose,
}: Props) {
  const [raw, setRaw] = useState(String(available));
  const [tried, setTried] = useState(false);
  const invalid = withdrawProblem(raw, available);
  const to = bankLabel(bank);

  if (done !== null)
    return (
      <Sheet
        visible={visible}
        title="Withdrawal requested"
        onClose={onClose}
        footer={<Button label="Done" onPress={onClose} testID="vendor-withdraw-done" />}
      >
        <Text variant="body">
          {`${formatNaira(done)} to ${to}. Bookhushly checks each withdrawal before sending it. You’ll see it under Activity as “on its way”, then “sent”.`}
        </Text>
      </Sheet>
    );

  return (
    <Sheet
      visible={visible}
      title="Withdraw"
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <View style={{ gap: space.s3 }}>
          {problem === null ? null : (
            <Banner
              tone={problem.transient ? 'neutral' : 'warning'}
              title={problem.title}
              message={problem.message}
            />
          )}
          <Button
            label="Withdraw"
            loading={busy}
            onPress={() => {
              setTried(true);
              if (invalid !== null || busy) return;
              onWithdraw(Number(raw.replace(/[,\s]/g, '')));
            }}
            testID="vendor-withdraw-send"
          />
        </View>
      }
    >
      <View style={{ gap: space.s5 }}>
        <Input
          label="Amount in naira"
          value={raw}
          onChangeText={setRaw}
          keyboardType="number-pad"
          inputMode="numeric"
          left={<Text variant="label">₦</Text>}
          hint={`You have ${formatNaira(available)} to withdraw`}
          error={tried && invalid !== null ? invalid : undefined}
          testID="vendor-withdraw-amount"
        />
        <View style={{ gap: space.s1 }}>
          <Text variant="caption" tone="textSecondary">
            To
          </Text>
          <Text variant="label">{to}</Text>
          <Text variant="caption" tone="textSecondary">
            Change your bank account on bookhushly.com.
          </Text>
        </View>
      </View>
    </Sheet>
  );
}
