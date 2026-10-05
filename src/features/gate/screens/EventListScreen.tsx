import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { eventLabel, groupEvents, pickAutoOpen } from '@/features/gate/domain/eventList';
import type { ScannableEvent } from '@/shared/api/scannableEvents';
import { color, density, radius, space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; events: ScannableEvent[] };

type Props = {
  state: State;
  nowMs: number;
  lastEventId: string | null;
  identity: string;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onOpen: (eventId: string) => void;
  onSignOut: () => void;
  header?: ReactNode;
};

function when(iso: string | null): string {
  if (iso === null) return 'Date to be confirmed';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Date to be confirmed';
  return new Date(t).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Row({ e, onOpen }: { e: ScannableEvent; onOpen: (id: string) => void }) {
  const label = eventLabel(e);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${when(e.startsAt)}`}
      onPress={() => {
        onOpen(e.id);
      }}
      style={({ pressed }) => ({
        minHeight: density.gate.rowMin,
        padding: space.s5,
        borderRadius: radius.r3,
        borderWidth: 1,
        borderColor: color.border,
        backgroundColor: pressed ? color.wash : color.surface,
        gap: space.s2,
      })}
    >
      <Text variant="bodyStrong" numberOfLines={2}>
        {label}
      </Text>
      <Text variant="bodySm" tone="textSecondary">
        {when(e.startsAt)}
        {e.location ? ` · ${e.location}` : ''}
      </Text>
    </Pressable>
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
    body = <ActivityIndicator color={color.actionFill} accessibilityLabel="Loading events" />;
  } else if (p.state.status === 'error') {
    body = (
      <View style={{ gap: space.s4 }}>
        <Text variant="body">We couldn&apos;t load your events. Check your connection.</Text>
        <Button label="Try again" onPress={p.onRetry} />
      </View>
    );
  } else if (p.state.events.length === 0) {
    body = <Text variant="body">No events assigned — ask the organiser.</Text>;
  } else {
    const g = groupEvents(p.state.events, p.nowMs);
    body = (
      <View style={{ gap: space.s4 }}>
        {g.upcoming.map((e) => (
          <Row key={e.id} e={e} onOpen={p.onOpen} />
        ))}
        {g.earlier.length > 0 ? (
          <>
            <Button
              variant="secondary"
              label={`Earlier (${String(g.earlier.length)})`}
              onPress={() => {
                setShowEarlier((v) => !v);
              }}
            />
            {showEarlier ? g.earlier.map((e) => <Row key={e.id} e={e} onOpen={p.onOpen} />) : null}
          </>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }}>
      <ScrollView
        contentContainerStyle={{ padding: space.s5, gap: space.s6 }}
        refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} />}
      >
        <View style={{ gap: space.s2 }}>
          <Text variant="titleLg" accessibilityRole="header">
            Your events
          </Text>
          <Text variant="bodySm" tone="textMuted">
            {p.identity}
          </Text>
        </View>
        {p.header}
        {body}
        <Button variant="secondary" label="Sign out" onPress={p.onSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
