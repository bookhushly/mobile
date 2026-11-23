import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList } from 'react-native';

import { NIGERIAN_STATES } from '@/shared/lib/phone';
import { Icon, ListRow, SearchField, Sheet } from '@/shared/ui';

/** "FCT" is the web's value; people say Abuja. */
export const stateName = (s: string) => (s === 'FCT' ? 'Abuja (FCT)' : s);

type Props = {
  visible: boolean;
  title: string;
  value: string | null;
  onPick: (state: string) => void;
  onClose: () => void;
};

// The state decides which companies are asked (the web fans the request out to vendors in the
// pick-up state), so it is chosen from the list, never typed.
export function StateSheet({ visible, title, value, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const states =
    needle === ''
      ? NIGERIAN_STATES
      : NIGERIAN_STATES.filter((s) => stateName(s).toLowerCase().includes(needle));
  return (
    <Sheet visible={visible} title={title} onClose={onClose} testID="state-sheet">
      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder="Search states"
        label="Search states"
      />
      <FlatList
        data={states}
        keyExtractor={(s) => s}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ListRow
            title={stateName(item)}
            checked={item === value}
            onPress={() => {
              setQ('');
              onPick(item);
            }}
            trailing={item === value ? <Icon as={Check} size="md" /> : undefined}
          />
        )}
      />
    </Sheet>
  );
}
