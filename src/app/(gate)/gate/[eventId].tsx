import { useQueryClient } from '@tanstack/react-query';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { gateKeys } from '@/features/gate/api/keys';
import { eventLabel } from '@/features/gate/domain/eventList';
import type { LookupQuery } from '@/features/gate/domain/lookupQuery';
import { shouldShowNotAssigned } from '@/features/gate/domain/lostAssignment';
import { useLastEvent } from '@/features/gate/hooks/useLastEvent';
import { useScannableEvents } from '@/features/gate/hooks/useScannableEvents';
import { useOfflineGate } from '@/features/gate/hooks/useOfflineGate';
import { useScanSession } from '@/features/gate/hooks/useScanSession';
import { useScanSummary } from '@/features/gate/hooks/useScanSummary';
import type { ActivityTab, Approval } from '@/features/gate/offline/outboxStore';
import { ScannerScreen } from '@/features/gate/screens/ScannerScreen';
import { useAppActive, useCameraAccess } from '@/features/gate/ui/ScannerCamera';
import { clock } from '@/shared/api/instance';
import { latestOnly } from '@/shared/lib/latest';
import { onceGuard } from '@/shared/lib/once';
import { shareCsv } from '@/shared/platform/shareCsv';

const eventIdParam = z.uuid();

function Scanner({ eventId }: { eventId: string }) {
  // Backgrounded counts as unfocused: the camera unmounts and polling stops (spec §5).
  const screenFocused = useIsFocused();
  const appActive = useAppActive();
  const focused = screenFocused && appActive;
  const qc = useQueryClient();
  const auth = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const events = useScannableEvents(userId);
  const { forget } = useLastEvent(userId);
  const listed = events.state.status === 'ready' ? events.state.events : [];
  const event = listed.find((e) => e.id === eventId);
  const offline = useOfflineGate({ eventId, userId, focused, startsAt: event?.startsAt ?? null });
  const camera = useCameraAccess();
  const { summary, stale, forbidden } = useScanSummary(eventId, focused);
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/gate');
  };
  // Once per screen: Done on two consecutive not-assigned overlays must not navigate twice.
  const [leaveOnce] = useState(onceGuard);
  // Staff read the not-assigned refusal and pressed Done: refresh the list and stop auto-opening
  // this event, so the next launch does not drop them straight back in here.
  const leaveLostAssignment = () => {
    leaveOnce(() => {
      if (userId !== null) void qc.invalidateQueries({ queryKey: gateKeys.events(userId) });
      void offline.controller?.dropList();
      forget();
      leave();
    });
  };
  const controller = offline.controller;
  // Before the offline gate is ready the sheet reads as "no list" (search) or "couldn't admit".
  const notReady = useCallback(() => Promise.reject(new Error('offline gate not ready')), []);
  const loadActivity = useCallback(
    (tab: ActivityTab, beforeSeq: number | null) =>
      controller?.activity(tab, beforeSeq) ?? notReady(),
    [controller, notReady],
  );
  const exportActivity = useCallback(
    () => controller?.exportRows() ?? notReady(),
    [controller, notReady],
  );
  const searchGuests = useCallback(
    (q: LookupQuery) => controller?.search(q) ?? Promise.resolve([]),
    [controller],
  );
  const bookingTickets = useCallback(
    (bookingId: string) => controller?.bookingTickets(bookingId) ?? notReady(),
    [controller, notReady],
  );
  const needsPinForLookup = useCallback(
    () => controller?.needsPinForLookup() ?? notReady(),
    [controller, notReady],
  );
  const checkPin = useCallback(
    (pin: string) => controller?.checkPin(pin) ?? notReady(),
    [controller, notReady],
  );
  const admitFromLookup = useCallback(
    (ticketId: string, approval: Approval | null) =>
      controller?.admitFromLookup(ticketId, approval) ?? notReady(),
    [controller, notReady],
  );
  const { session, muted, toggleMute } = useScanSession(eventId, offline.scan, offline.controller?.tally);

  // A summary 403 is codeless, so only a fresh events list can confirm the assignment is gone.
  const { refresh: refreshEvents } = events;
  const [latest] = useState(latestOnly);
  useEffect(() => {
    if (!forbidden || userId === null) return;
    const current = latest.begin();
    void refreshEvents().then((fresh) => {
      // A superseded or cancelled refresh may resolve with cached data: ignore it.
      if (!current()) return;
      if (shouldShowNotAssigned({ userId, summaryForbidden: true, events: fresh, eventId })) {
        session.showNotAssigned();
      }
    });
    return () => {
      latest.begin();
    };
  }, [forbidden, userId, refreshEvents, eventId, session, latest]);

  const { permission, request } = camera;
  useEffect(() => {
    if (permission === 'unknown') request();
  }, [permission, request]);

  return (
    <ScannerScreen
      title={event ? eventLabel(event) : 'Scanning'}
      summary={summary}
      summaryStale={stale}
      focused={focused}
      permission={camera.permission}
      canAskPermission={camera.canAsk}
      onRequestPermission={camera.request}
      onOpenSettings={() => {
        void Linking.openSettings();
      }}
      muted={muted}
      onToggleMute={toggleMute}
      session={session}
      onSignIn={() => {
        void signOut({ keepOfflineData: true });
      }}
      onChangeEvent={leave}
      onLostAssignment={leaveLostAssignment}
      onRefreshList={() => {
        controller?.refreshList();
      }}
      onSyncNow={() => {
        controller?.syncNow();
      }}
      loadActivity={loadActivity}
      exportActivity={exportActivity}
      shareCsv={shareCsv}
      searchGuests={searchGuests}
      bookingTickets={bookingTickets}
      needsPinForLookup={needsPinForLookup}
      checkPin={checkPin}
      admitFromLookup={admitFromLookup}
      serverNow={clock.serverNow}
    />
  );
}

export default function GateScannerRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const parsed = eventIdParam.safeParse(eventId);
  useEffect(() => {
    if (!parsed.success) router.replace('/gate');
  }, [parsed.success]);
  if (!parsed.success) return null;
  // Keyed so switching events mounts a fresh session (spec: reset on event switch).
  return <Scanner key={parsed.data} eventId={parsed.data} />;
}
