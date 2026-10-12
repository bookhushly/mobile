import { ArrowLeft, History } from 'lucide-react-native';
import { FlatList } from 'react-native';

import { useShiftLog, type ShiftEntry } from '@/features/receptionist/state/shiftLog';
import { lagosTime } from '@/shared/lib/lagosDay';
import { EmptyState, Header, IconButton, ListRow, Screen } from '@/shared/ui';

type Props = { onBack: () => void };

// R11: this device's own check-ins, check-outs and room changes since the desk opened, newest
// first (the log prepends). Memory only; the receptionist layout clears it on the way out.
export function ActivityScreen({ onBack }: Props) {
  const entries = useShiftLog((s) => s.entries);
  return (
    <Screen
      header={
        <Header
          title="Shift activity"
          subtitle="This device, since you opened the front desk"
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
    >
      <FlatList
        data={entries}
        style={{ flex: 1 }}
        keyExtractor={(e: ShiftEntry, i) => `${String(e.at)}-${String(i)}`}
        renderItem={({ item }) => (
          <ListRow title={item.text} subtitle={lagosTime(new Date(item.at).toISOString())} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={History}
            title="Nothing yet"
            message="Check-ins, check-outs and room changes you make here appear in this list."
          />
        }
      />
    </Screen>
  );
}
