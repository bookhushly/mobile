import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { activityCsv, type ActivityRow } from '@/features/gate/domain/activityCsv';
import { attentionLine } from '@/features/gate/domain/syncLine';
import type { ActivityTab, AttentionItem } from '@/features/gate/offline/outboxStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { parseIsoMs } from '@/shared/lib/isoTime';
import { ACTIVITY_FILE } from '@/shared/platform/shareCsv';
import { color, density, radius, space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  initialTab: ActivityTab;
  load: (tab: ActivityTab, beforeSeq: number | null) => Promise<AttentionItem[]>;
  exportRows: () => Promise<ActivityRow[]>;
  share: (fileName: string, text: string) => Promise<void>;
  onSyncNow: () => void;
  onClose: () => void;
};

// The controller's page size: a full page means there may be more.
const PAGE = 50;
const EXPORT_FAILED = 'Couldn’t export — try again';

const TABS: readonly { tab: ActivityTab; label: string; empty: string }[] = [
  { tab: 'toSync', label: 'To sync', empty: 'Nothing waiting to sync.' },
  { tab: 'attention', label: 'Needs attention', empty: 'Nothing needs attention.' },
  { tab: 'synced', label: 'Synced', empty: 'Nothing synced yet.' },
];

const ticketLabel = (i: AttentionItem) =>
  `${i.ticketType ?? 'Ticket'}${i.ticketIndex === null ? '' : ` · ticket ${String(i.ticketIndex)}`}`;
const pad = (n: number) => String(n).padStart(2, '0');
const localTime = (iso: string) => {
  const t = parseIsoMs(iso);
  if (t === null) return '';
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const marker = (i: AttentionItem) =>
  i.mode === 'manual_lookup' ? 'Lookup' : i.mode === 'offline_override' ? 'Override' : null;
const stateLine = (i: AttentionItem) => {
  const line = attentionLine(i);
  if (line !== '') return line;
  return i.state === 'synced' ? 'Synced' : 'Waiting to sync';
};

type Page = {
  tab: ActivityTab;
  rows: AttentionItem[] | 'failed';
  more: boolean;
  moreState: 'idle' | 'loading' | 'failed';
};

function Row({ item }: { item: AttentionItem }) {
  const m = marker(item);
  return (
    <View
      style={{
        minHeight: density.work.rowMin,
        justifyContent: 'center',
        gap: space.s1,
        paddingVertical: space.s2,
        borderBottomWidth: 1,
        borderBottomColor: color.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
          {ticketLabel(item)}
        </Text>
        {m !== null ? (
          <View
            style={{
              backgroundColor: color.selectedWash,
              borderRadius: radius.r2,
              paddingHorizontal: space.s2,
            }}
          >
            <Text variant="labelSm" tone="linkText">
              {m}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text variant="labelSm" tone="textSecondary" tabular>
          {localTime(item.scannedAt)}
        </Text>
      </View>
      <Text variant="bodySm" tone="textSecondary">
        {stateLine(item)}
      </Text>
    </View>
  );
}

// Read-only (FR-3.13/3.14): no undo or delete; problems are for the organiser to review.
export function ActivityScreen({
  visible,
  initialTab,
  load,
  exportRows,
  share,
  onSyncNow,
  onClose,
}: Props) {
  const [tab, setTab] = useState<ActivityTab>(initialTab);
  const [page, setPage] = useState<Page | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  // Bumped on every first-page load and on close: late results from an older request are dropped.
  const gen = useRef(0);
  // Bumped on close only: an export finishing after the screen closed changes nothing.
  const openGen = useRef(0);
  const exportBusy = useRef(false);
  // A sync moves rows between tabs: the first page reloads when the counts change.
  const pending = useSyncView((s) => s.status.pending);
  const attention = useSyncView((s) => s.status.attention);

  // Open on the requested tab; clear on close (adjusting state during render, not in an effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setTab(initialTab);
    } else {
      setPage(null);
      setExporting(false);
      setExportError(null);
    }
  }
  useEffect(() => {
    if (!visible) {
      gen.current += 1;
      openGen.current += 1;
      exportBusy.current = false;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    gen.current += 1;
    const mine = gen.current;
    load(tab, null).then(
      (rows) => {
        if (mine === gen.current)
          setPage({ tab, rows, more: rows.length === PAGE, moreState: 'idle' });
      },
      () => {
        if (mine === gen.current) setPage({ tab, rows: 'failed', more: false, moreState: 'idle' });
      },
    );
  }, [visible, tab, load, pending, attention]);

  const shown = page !== null && page.tab === tab ? page : null;

  const loadMore = () => {
    if (shown === null || shown.rows === 'failed' || shown.moreState === 'loading') return;
    const last = shown.rows.at(-1);
    if (last === undefined) return;
    const mine = gen.current;
    setPage({ ...shown, moreState: 'loading' });
    load(tab, last.seq).then(
      (rows) => {
        if (mine !== gen.current) return;
        setPage((p) =>
          p === null || p.rows === 'failed'
            ? p
            : { ...p, rows: [...p.rows, ...rows], more: rows.length === PAGE, moreState: 'idle' },
        );
      },
      () => {
        if (mine !== gen.current) return;
        setPage((p) => (p === null ? p : { ...p, moreState: 'failed' }));
      },
    );
  };

  async function runExport() {
    if (exportBusy.current) return;
    exportBusy.current = true;
    const mine = openGen.current;
    setExporting(true);
    setExportError(null);
    let failed = false;
    try {
      await share(ACTIVITY_FILE, activityCsv(await exportRows()));
    } catch {
      failed = true;
    }
    if (mine !== openGen.current) return;
    exportBusy.current = false;
    setExporting(false);
    if (failed) setExportError(EXPORT_FAILED);
  }

  const empty = TABS.find((t) => t.tab === tab)?.empty ?? '';
  const rows = shown === null || shown.rows === 'failed' ? [] : shown.rows;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      testID="activity-screen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: color.surface }}>
        <View style={{ padding: space.s5, gap: space.s4, flex: 1 }}>
          <Text variant="title" accessibilityRole="header">
            Activity
          </Text>
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: 'row',
              backgroundColor: color.wash,
              borderRadius: radius.r3,
              padding: space.s1,
              gap: space.s1,
            }}
          >
            {TABS.map((t) => {
              const selected = t.tab === tab;
              return (
                <Pressable
                  key={t.tab}
                  accessibilityRole="tab"
                  accessibilityLabel={t.label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setTab(t.tab);
                  }}
                  style={{
                    flex: 1,
                    minHeight: density.gate.minTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: space.s1,
                    borderRadius: radius.r2,
                    backgroundColor: selected ? color.surface : color.wash,
                    borderWidth: 1,
                    borderColor: selected ? color.border : color.wash,
                  }}
                >
                  <Text
                    variant="labelSm"
                    tone={selected ? 'textPrimary' : 'textSecondary'}
                    numberOfLines={2}
                    style={{ textAlign: 'center' }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <FlatList
            data={rows}
            style={{ flex: 1 }}
            keyExtractor={(i) => String(i.seq)}
            renderItem={({ item }) => <Row item={item} />}
            ListEmptyComponent={
              <Text variant="bodySm" tone="textMuted" accessibilityLiveRegion="polite">
                {shown === null
                  ? 'Loading…'
                  : shown.rows === 'failed'
                    ? 'Couldn’t load the list — try again.'
                    : empty}
              </Text>
            }
            ListFooterComponent={
              shown !== null && shown.rows !== 'failed' && shown.more ? (
                <View style={{ paddingTop: space.s3, gap: space.s2 }}>
                  {shown.moreState === 'failed' ? (
                    <Text variant="bodySm" style={{ color: color.status.danger.fg }}>
                      Couldn’t load more — try again
                    </Text>
                  ) : null}
                  <Button
                    variant="secondary"
                    label="Load more"
                    loading={shown.moreState === 'loading'}
                    onPress={loadMore}
                  />
                </View>
              ) : null
            }
          />
          {exportError !== null ? (
            <Text
              variant="bodyStrong"
              accessibilityLiveRegion="polite"
              style={{ color: color.status.danger.fg }}
            >
              {exportError}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.s3 }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label="Sync now" onPress={onSyncNow} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                label="Export CSV"
                loading={exporting}
                onPress={() => void runExport()}
              />
            </View>
          </View>
          <Button label="Close" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
