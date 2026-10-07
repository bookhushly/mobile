import { useEffect, useState } from 'react';
import { FlatList, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { attentionLine } from '@/features/gate/domain/syncLine';
import type { AttentionItem } from '@/features/gate/offline/outboxStore';
import { color, density, space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

type Props = { visible: boolean; load: () => Promise<AttentionItem[]>; onClose: () => void };

const label = (i: AttentionItem) =>
  `${i.ticketType ?? 'Ticket'}${i.ticketIndex === null ? '' : ` · ticket ${String(i.ticketIndex)}`}`;

// Read-only (FR-3.13: no undo). Duplicates and suspects are for the organiser to review.
export function AttentionSheet({ visible, load, onClose }: Props) {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void load()
      .then((v) => {
        if (live) setItems(v);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      // Clear on close so a previous open's items never flash on the next one.
      setItems(null);
      setFailed(false);
    };
  }, [visible, load]);

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
            Needs attention
          </Text>
          <Text variant="bodySm" tone="textSecondary">
            Review these with the organiser. Nothing to undo here.
          </Text>
          <FlatList
            data={items ?? []}
            ListEmptyComponent={
              <Text variant="bodySm" tone="textMuted">
                {failed
                  ? 'Couldn’t load the list — try again.'
                  : items === null
                    ? 'Loading…'
                    : 'Nothing needs attention.'}
              </Text>
            }
            keyExtractor={(i) => String(i.seq)}
            renderItem={({ item }) => (
              <View
                style={{
                  minHeight: density.work.rowMin,
                  justifyContent: 'center',
                  gap: space.s1,
                  borderBottomWidth: 1,
                  borderBottomColor: color.border,
                }}
              >
                <Text variant="bodyStrong">{label(item)}</Text>
                <Text variant="bodySm" tone="textSecondary">
                  {attentionLine(item)}
                </Text>
              </View>
            )}
          />
          <Button variant="secondary" label="Close" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
