import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACTIVITY_PAGE, activityCsv, type ActivityRow } from '@/features/gate/domain/activityCsv';
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

const EXPORT_FAILED = 'Couldn’t export — try again';
const LOAD_FAILED = 'Couldn’t load the list — try again.';

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

// The last successful first page (plus pages appended to it). `key` names the request that
// produced it: a count change while open is a new key, so a stale load-more can be recognised.
type Page = {
  tab: ActivityTab;
  key: string;
  rows: AttentionItem[];
  more: boolean;
  moreState: 'idle' | 'loading' | 'failed';
};

const appendNew = (rows: AttentionItem[], next: AttentionItem[]) => {
  const seen = new Set(rows.map((i) => i.seq));
  return [...rows, ...next.filter((i) => !seen.has(i.seq))];
};

function Row({ item }: { item: AttentionItem }) {
  const m = marker(item);
  const time = localTime(item.scannedAt);
  const label = [ticketLabel(item), time, m, stateLine(item)]
    .filter((x): x is string => x !== null && x !== '')
    .join(', ');
  return (
    <View
      accessible
      accessibilityLabel={label}
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
          {time}
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
  // The key whose first-page load failed (the previous rows stay visible under the error).
  const [failedKey, setFailedKey] = useState<string | null>(null);
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
      setFailedKey(null);
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

  const key = `${tab}|${String(pending)}|${String(attention)}`;
  useEffect(() => {
    if (!visible) return;
    gen.current += 1;
    const mine = gen.current;
    load(tab, null).then(
      (rows) => {
        if (mine !== gen.current) return;
        setPage({ tab, key, rows, more: rows.length === ACTIVITY_PAGE, moreState: 'idle' });
        setFailedKey(null);
      },
      () => {
        if (mine === gen.current) setFailedKey(key);
      },
    );
  }, [visible, tab, key, load]);

  const shown = page !== null && page.tab === tab ? page : null;
  const loadFailed = failedKey === key;
  // A (re)load for the current key is still in flight: paging waits for it.
  const reloading = !loadFailed && page?.key !== key;

  const loadMore = () => {
    if (shown === null || reloading || shown.moreState === 'loading') return;
    const last = shown.rows.at(-1);
    if (last === undefined) return;
    const forKey = shown.key;
    const mine = gen.current;
    setPage({ ...shown, moreState: 'loading' });
    // Appends only onto the exact page it continues: a reload in between replaced that page.
    const same = (p: Page | null): p is Page =>
      p !== null && p.tab === tab && p.key === forKey && p.rows.at(-1)?.seq === last.seq;
    load(tab, last.seq).then(
      (rows) => {
        if (mine !== gen.current) return;
        setPage((p) =>
          same(p)
            ? {
                ...p,
                rows: appendNew(p.rows, rows),
                more: rows.length === ACTIVITY_PAGE,
                moreState: 'idle',
              }
            : p,
        );
      },
      () => {
        if (mine !== gen.current) return;
        setPage((p) => (same(p) ? { ...p, moreState: 'failed' } : p));
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
      const text = activityCsv(await exportRows());
      // Closed while the rows were read: the share sheet must not open over the scanner.
      if (mine !== openGen.current) return;
      await share(ACTIVITY_FILE, text);
    } catch {
      failed = true;
    }
    if (mine !== openGen.current) return;
    exportBusy.current = false;
    setExporting(false);
    if (failed) setExportError(EXPORT_FAILED);
  }

  const empty = TABS.find((t) => t.tab === tab)?.empty ?? '';
  const rows = shown === null ? [] : shown.rows;

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
          {loadFailed && shown !== null ? (
            <Text
              variant="bodySm"
              accessibilityLiveRegion="polite"
              style={{ color: color.status.danger.fg }}
            >
              {LOAD_FAILED}
            </Text>
          ) : null}
          <FlatList
            data={rows}
            style={{ flex: 1 }}
            keyExtractor={(i) => String(i.seq)}
            renderItem={({ item }) => <Row item={item} />}
            ListEmptyComponent={
              <Text variant="bodySm" tone="textMuted" accessibilityLiveRegion="polite">
                {shown !== null ? empty : loadFailed ? LOAD_FAILED : 'Loading…'}
              </Text>
            }
            ListFooterComponent={
              shown !== null && shown.more && !reloading ? (
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
