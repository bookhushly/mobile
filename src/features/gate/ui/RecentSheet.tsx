import { ListChecks } from 'lucide-react-native';
import { FlatList } from 'react-native';

import type { ScanSummary } from '@/features/gate/schemas/scan';
import { EmptyState, ListRow, Sheet, StatusPill, Text } from '@/shared/ui';

type Props = { visible: boolean; recent: ScanSummary['recent'] | null; onClose: () => void };

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
    : '';
};

export function RecentSheet({ visible, recent, onClose }: Props) {
  return (
    <Sheet visible={visible} title="Recent admissions" onClose={onClose}>
      {recent === null ? (
        <Text variant="body" tone="textMuted">
          Not loaded yet.
        </Text>
      ) : recent.length === 0 ? (
        <EmptyState icon={ListChecks} title="No admissions yet" />
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <ListRow
              title={item.ticket_type ?? 'Ticket'}
              subtitle={time(item.checked_in_at)}
              trailing={
                item.scanned_by_me ? <StatusPill tone="neutral" label="By me" /> : undefined
              }
            />
          )}
        />
      )}
    </Sheet>
  );
}
