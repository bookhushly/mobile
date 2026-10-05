import { useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseTicketCode } from '@/features/gate/domain/parseTicketCode';
import { color, space } from '@/shared/theme';
import { Button, Input, Text } from '@/shared/ui';

type Props = { visible: boolean; onSubmit: (raw: string) => void; onClose: () => void };

export function EnterCodeSheet({ visible, onSubmit, onClose }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (parseTicketCode(value) === null) {
      setError('That is not a Bookhushly ticket code or link.');
      return;
    }
    onSubmit(value);
    setValue('');
    setError(null);
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
        <View style={{ padding: space.s5, gap: space.s5 }}>
          <Text variant="title" accessibilityRole="header">
            Enter code
          </Text>
          <Input
            label="Ticket code or link"
            value={value}
            onChangeText={(t) => {
              setValue(t);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            error={error ?? undefined}
          />
          <Button label="Check ticket" onPress={submit} />
          <Button variant="secondary" label="Cancel" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
