import { useState } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Banner, Button, Input, Sheet, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  /** Paid (or on the trip): cancelling starts a refund. */
  paid: boolean;
  busy: boolean;
  problem: string | null;
  onCancel: (reason: string) => void;
  onClose: () => void;
};

export function CarCancelSheet({ visible, paid, busy, problem, onCancel, onClose }: Props) {
  const [reason, setReason] = useState('');
  return (
    <Sheet
      visible={visible}
      title={paid ? 'Cancel this booking?' : 'Cancel this request?'}
      onClose={onClose}
      closeDisabled={busy}
      scroll
      testID="car-cancel-sheet"
      footer={
        <View style={{ gap: space.s3 }}>
          <Button
            label={paid ? 'Cancel booking' : 'Cancel request'}
            variant="destructive"
            loading={busy}
            disabled={busy}
            onPress={() => {
              onCancel(reason);
            }}
            testID="car-cancel-confirm"
          />
          <Button label="Keep it" variant="ghost" disabled={busy} onPress={onClose} />
        </View>
      }
    >
      <View style={{ gap: space.s5 }}>
        <Text variant="body">
          {paid
            ? 'The company is told at once, and a refund of your payment is started.'
            : 'Companies can’t quote on it any more. Nothing has been charged.'}
        </Text>
        <Input
          label="Why are you cancelling? (optional)"
          value={reason}
          onChangeText={setReason}
          maxLength={500}
          multiline
        />
        {problem === null ? null : <Banner tone="neutral" message={problem} />}
      </View>
    </Sheet>
  );
}
