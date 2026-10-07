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

// Read-only (FR-3.13: no undo). Duplicates and suspects surface to the organiser on the web.
export function AttentionSheet({ visible, load, onClose }: Props) {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void load()
      .then((v) => {
        if (live) setItems(v);
      })
      .catch(() => {
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, [visible, load]);

  const [now] = useState(Date.now);
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
            The organiser sees these on the web. Nothing to undo here.
          </Text>
          <FlatList
            data={items ?? []}
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
                  {attentionLine(item, now)}
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
