import { CircleCheck, Clock, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

import { ACTIVITY_PAGE, activityCsv, type ActivityRow } from '@/features/gate/domain/activityCsv';
import { ago } from '@/features/gate/domain/ago';
import { attentionLine, groupDigits } from '@/features/gate/domain/syncLine';
import type { ActivityTab, AttentionItem, OutboxState } from '@/features/gate/offline/outboxStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { parseIsoMs } from '@/shared/lib/isoTime';
import { ACTIVITY_FILE } from '@/shared/platform/shareCsv';
import { space, type ColorRole, type StatusTone } from '@/shared/theme';
import {
  Banner,
  Button,
  Card,
  Icon,
  ListRow,
  SectionHeader,
  SegmentedControl,
  Sheet,
  StatusPill,
  Text,
} from '@/shared/ui';

type Props = {
  visible: boolean;
  initialTab: ActivityTab;
  load: (tab: ActivityTab, beforeSeq: number | null) => Promise<AttentionItem[]>;
  exportRows: () => Promise<ActivityRow[]>;
  share: (fileName: string, text: string) => Promise<void>;
  onSyncNow: () => void;
  onRefreshList: () => void;
  /** Server-corrected now, for the offline list's "updated … ago". */
  now: () => number;
  onClose: () => void;
};

const EXPORT_FAILED = 'Couldn’t export — try again';
const LOAD_FAILED = 'Couldn’t load the list — try again.';
const LOAD_MORE_FAILED = 'Couldn’t load more — try again';

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
const localHour = (iso: string) => {
  const t = parseIsoMs(iso);
  if (t === null) return null;
  return `${pad(new Date(t).getHours())}:00`;
};
const marker = (i: AttentionItem) =>
  i.mode === 'manual_lookup' ? 'Lookup' : i.mode === 'offline_override' ? 'Override' : null;
const stateLine = (i: AttentionItem) => {
  const line = attentionLine(i);
  if (line !== '') return line;
  return i.state === 'synced' ? 'Synced' : 'Waiting to sync';
};

const toneOf = (state: OutboxState): StatusTone => {
  switch (state) {
    case 'pending':
    case 'sending':
      return 'neutral';
    case 'synced':
      return 'success';
    case 'duplicate':
    case 'suspect':
      return 'warning';
    case 'rejected':
    case 'blocked':
    case 'error':
      return 'danger';
  }
};
const stateWord = (state: OutboxState): string => {
  switch (state) {
    case 'pending':
    case 'sending':
      return 'To sync';
    case 'synced':
      return 'Synced';
    case 'duplicate':
      return 'Duplicate';
    case 'suspect':
      return 'Check';
    case 'rejected':
      return 'Rejected';
    case 'blocked':
    case 'error':
      return 'Not sent';
  }
};
const FG: Record<StatusTone, ColorRole> = {
  neutral: 'neutralFg',
  info: 'infoFg',
  success: 'successFg',
  warning: 'warningFg',
  danger: 'dangerFg',
};
const glyphOf = (state: OutboxState): LucideIcon => {
  switch (toneOf(state)) {
    case 'neutral':
    case 'info':
      return Clock;
    case 'success':
      return CircleCheck;
    case 'warning':
    case 'danger':
      return TriangleAlert;
  }
};
function StateIcon({ state }: { state: OutboxState }) {
  return <Icon as={glyphOf(state)} size="sm" tone={FG[toneOf(state)]} />;
}

// Rows grouped under their local hour (computed in render from the page's rows).
type Entry = { kind: 'header'; key: string; label: string } | { kind: 'row'; item: AttentionItem };
const groupByHour = (rows: AttentionItem[]): Entry[] => {
  const out: Entry[] = [];
  let last: string | null = null;
  for (const item of rows) {
    const hour = localHour(item.scannedAt);
    if (hour !== null && hour !== last) {
      out.push({ kind: 'header', key: `h${String(item.seq)}`, label: hour });
      last = hour;
    }
    out.push({ kind: 'row', item });
  }
  return out;
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
  const note = attentionLine(item);
  // The Lookup/Override marker is plain text in the subtitle: violet is for actions, not state.
  const subtitle = [time, m].filter((x): x is string => x !== null && x !== '').join(' · ');
  return (
    <ListRow
      leading={<StateIcon state={item.state} />}
      title={ticketLabel(item)}
      subtitle={subtitle === '' ? undefined : subtitle}
      trailing={<StatusPill tone={toneOf(item.state)} label={stateWord(item.state)} />}
      note={
        note !== '' ? (
          <Text variant="bodySm" tone="textSecondary">
            {note}
          </Text>
        ) : undefined
      }
      accessibilityLabel={label}
    />
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
  onRefreshList,
  now,
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
  const list = useSyncView((s) => s.status.list);

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
  const entries = groupByHour(rows);
  const tabs = TABS.map((t) => ({
    value: t.tab,
    label: t.label,
    count: t.tab === 'toSync' ? pending : t.tab === 'attention' ? attention : undefined,
  }));

  return (
    <Sheet
      visible={visible}
      title="Activity"
      onClose={onClose}
      testID="activity-screen"
      right={
        <Button
          variant="ghost"
          label="Export"
          accessibilityLabel="Export CSV"
          loading={exporting}
          onPress={() => void runExport()}
        />
      }
      footer={pending > 0 ? <Button label="Sync now" onPress={onSyncNow} /> : undefined}
    >
      <Card>
        <View style={{ gap: space.s3 }}>
          <View style={{ gap: space.s1 }}>
            <Text variant="bodyStrong">Offline list</Text>
            <Text variant="bodySm" tone="textSecondary">
              {list === null
                ? 'Not downloaded yet'
                : `${groupDigits(list.count)} tickets · updated ${ago(list.syncedAt, now())}`}
            </Text>
          </View>
          <Button variant="secondary" label="Refresh list" onPress={onRefreshList} />
        </View>
      </Card>
      <SegmentedControl value={tab} options={tabs} onChange={setTab} />
      {loadFailed ? <Banner tone="neutral" message={LOAD_FAILED} /> : null}
      {exportError !== null ? (
        <Banner tone="neutral" message={exportError} live="assertive" />
      ) : null}
      <FlatList
        data={entries}
        style={{ flex: 1 }}
        keyExtractor={(e) => (e.kind === 'header' ? e.key : `r${String(e.item.seq)}`)}
        renderItem={({ item: e }) =>
          e.kind === 'header' ? <SectionHeader label={e.label} /> : <Row item={e.item} />
        }
        ListEmptyComponent={
          shown !== null ? (
            <Text tone="textMuted" accessibilityLiveRegion="polite">
              {empty}
            </Text>
          ) : loadFailed ? null : (
            <Text tone="textMuted" accessibilityLiveRegion="polite">
              Loading…
            </Text>
          )
        }
        ListFooterComponent={
          shown !== null && shown.more && !reloading ? (
            <View style={{ paddingTop: space.s3, gap: space.s2 }}>
              {shown.moreState === 'failed' ? (
                <Banner tone="neutral" message={LOAD_MORE_FAILED} />
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
    </Sheet>
  );
}
