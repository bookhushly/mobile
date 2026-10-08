import { Download, UserRound } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';

import {
  dateTile,
  eventLabel,
  eventStatus,
  groupEvents,
  pickAutoOpen,
  type EventStatus,
} from '@/features/gate/domain/eventList';
import type { ScannableEvent } from '@/shared/api/scannableEvents';
import { borderWidth, color, radius, space } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  SkeletonRows,
  StatusPill,
  Text,
} from '@/shared/ui';

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; events: ScannableEvent[] };

type Props = {
  state: State;
  nowMs: number;
  lastEventId: string | null;
  /** Events with a finished offline list on this phone. */
  offlineLists: ReadonlySet<string>;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onOpen: (eventId: string) => void;
  onOpenAccount: () => void;
};

const TILE = 56;

function when(iso: string | null): string {
  if (iso === null) return 'Date to be confirmed';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Date to be confirmed';
  return new Date(t).toLocaleString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeOf(e: ScannableEvent): string {
  const t = e.startsAt === null ? NaN : Date.parse(e.startsAt);
  if (!Number.isFinite(t)) return 'Time to be confirmed';
  return new Date(t).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

function DateTile({ e }: { e: ScannableEvent }) {
  const tile = dateTile(e);
  return (
    <View
      style={{
        width: TILE,
        height: TILE,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.r3,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: color.surface,
      }}
    >
      {tile === null ? (
        <Text variant="labelSm" tone="textSecondary">
          TBC
        </Text>
      ) : (
        <>
          <Text variant="labelSm" tone="linkText">
            {tile.month}
          </Text>
          <Text variant="title" maxScale={1}>
            {tile.day}
          </Text>
          <Text variant="caption" tone="textSecondary">
            {tile.weekday}
          </Text>
        </>
      )}
    </View>
  );
}

const STATUS_TEXT: Record<EventStatus, string | null> = {
  live: 'Live now',
  today: 'Today',
  upcoming: 'Upcoming',
  ended: null,
};

function statusPill(status: EventStatus | null): ReactNode {
  switch (status) {
    case 'live':
      return <StatusPill tone="success" label="Live now" size="sm" />;
    case 'today':
      return <StatusPill tone="info" label="Today" size="sm" />;
    case 'upcoming':
      return <StatusPill tone="neutral" label="Upcoming" size="sm" />;
    case 'ended':
    case null:
      return null;
  }
}

function EventRow({
  e,
  nowMs,
  offline,
  onOpen,
}: {
  e: ScannableEvent;
  nowMs: number;
  offline: boolean;
  onOpen: (id: string) => void;
}) {
  const label = eventLabel(e);
  const status = eventStatus(e, nowMs);
  const pill = statusPill(status);
  // Screen readers hear everything the row shows: when, where, status and the offline mark.
  const spoken = [
    label,
    when(e.startsAt),
    e.location,
    status === null ? null : STATUS_TEXT[status],
    offline ? 'Offline list ready' : null,
  ]
    .filter((s): s is string => s !== null && s !== '')
    .join(', ');
  const note =
    pill !== null || offline ? (
      <View style={{ flexDirection: 'row', gap: space.s2, flexWrap: 'wrap', marginTop: space.s1 }}>
        {pill}
        {offline ? (
          <StatusPill tone="neutral" icon={Download} label="Offline list ready" size="sm" />
        ) : null}
      </View>
    ) : undefined;
  return (
    <ListRow
      onPress={() => {
        onOpen(e.id);
      }}
      leading={<DateTile e={e} />}
      title={label}
      subtitle={[timeOf(e), e.location].filter(Boolean).join(' · ')}
      note={note}
      accessibilityLabel={spoken}
    />
  );
}

export function EventListScreen(p: Props) {
  const [showEarlier, setShowEarlier] = useState(false);
  const autoOpened = useRef(false);
  const events = p.state.status === 'ready' ? p.state.events : null;
  const { onOpen, lastEventId, nowMs } = p;

  useEffect(() => {
    if (autoOpened.current || events === null) return;
    autoOpened.current = true;
    const id = pickAutoOpen(events, lastEventId, nowMs);
    if (id !== null) onOpen(id);
  }, [events, lastEventId, nowMs, onOpen]);

  let body: ReactNode;
  if (p.state.status === 'loading') {
    body = <SkeletonRows count={4} />;
  } else if (p.state.status === 'error') {
    body = (
      <ErrorState
        title="Couldn’t load your events"
        message="Check your connection."
        safeLine={p.offlineLists.size > 0 ? 'Offline lists on this phone still work' : undefined}
        onRetry={p.onRetry}
      />
    );
  } else if (p.state.events.length === 0) {
    body = (
      <EmptyState
        illustration="noEvents"
        title="No events assigned"
        message="Ask the organiser to add you as gate staff."
        action={{ label: 'Refresh', onPress: p.onRefresh }}
      />
    );
  } else {
    const g = groupEvents(p.state.events, p.nowMs);
    const row = (e: ScannableEvent) => (
      <EventRow
        key={e.id}
        e={e}
        nowMs={p.nowMs}
        offline={p.offlineLists.has(e.id)}
        onOpen={p.onOpen}
      />
    );
    body = (
      <View>
        {g.upcoming.map(row)}
        {g.earlier.length > 0 ? (
          <>
            <SectionHeader
              label="Earlier"
              count={g.earlier.length}
              expanded={showEarlier}
              onToggle={() => {
                setShowEarlier((v) => !v);
              }}
            />
            {showEarlier ? g.earlier.map(row) : null}
          </>
        ) : null}
      </View>
    );
  }

  return (
    <Screen
      scroll
      bg="canvas"
      refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} />}
      header={
        <Header
          title="Events"
          right={
            <IconButton icon={UserRound} accessibilityLabel="Account" onPress={p.onOpenAccount} />
          }
        />
      }
    >
      {body}
    </Screen>
  );
}
