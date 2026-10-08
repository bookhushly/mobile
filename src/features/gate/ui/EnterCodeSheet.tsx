import { useState } from 'react';

import { parseTicketCode } from '@/features/gate/domain/parseTicketCode';
import { Button, Input, Sheet } from '@/shared/ui';

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
    <Sheet
      visible={visible}
      title="Enter code"
      onClose={onClose}
      scroll
      footer={<Button label="Check ticket" onPress={submit} />}
    >
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
    </Sheet>
  );
}
