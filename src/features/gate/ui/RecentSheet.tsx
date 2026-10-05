import { FlatList, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ScanSummary } from '@/features/gate/schemas/scan';
import { color, density, space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

type Props = { visible: boolean; recent: ScanSummary['recent'] | null; onClose: () => void };

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
};

export function RecentSheet({ visible, recent, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
        <View style={{ padding: space.s5, gap: space.s4, flex: 1 }}>
          <Text variant="title" accessibilityRole="header">
            Recent admissions
          </Text>
          {recent === null ? (
            <Text variant="body" tone="textMuted">
              Not loaded yet.
            </Text>
          ) : recent.length === 0 ? (
            <Text variant="body">No admissions yet.</Text>
          ) : (
            <FlatList
              data={recent}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <View
                  style={{
                    minHeight: density.work.rowMin,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottomWidth: 1,
                    borderBottomColor: color.border,
                  }}
                >
                  <View style={{ gap: space.s1 }}>
                    <Text variant="bodyStrong">{item.ticket_type ?? 'Ticket'}</Text>
                    <Text variant="bodySm" tone="textSecondary" tabular>
                      {time(item.checked_in_at)}
                    </Text>
                  </View>
                  {item.scanned_by_me ? (
                    <Text variant="labelSm" tone="linkText">
                      By me
                    </Text>
                  ) : null}
                </View>
              )}
            />
          )}
          <Button variant="secondary" label="Close" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
