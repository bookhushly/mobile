import { useQueryClient } from '@tanstack/react-query';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { z } from 'zod';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { gateKeys } from '@/features/gate/api/keys';
import { eventLabel } from '@/features/gate/domain/eventList';
import { useLastEvent } from '@/features/gate/hooks/useLastEvent';
import { useScannableEvents } from '@/features/gate/hooks/useScannableEvents';
import { useScanSession } from '@/features/gate/hooks/useScanSession';
import { useScanSummary } from '@/features/gate/hooks/useScanSummary';
import { ScannerScreen } from '@/features/gate/screens/ScannerScreen';
import { useAppActive, useCameraAccess } from '@/features/gate/ui/ScannerCamera';

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
  const camera = useCameraAccess();
  const { summary, stale } = useScanSummary(eventId, focused);
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/gate');
  };
  // Staff read the not-assigned refusal and pressed Done: refresh the list and stop auto-opening
  // this event, so the next launch does not drop them straight back in here.
  const leaveLostAssignment = () => {
    if (userId !== null) void qc.invalidateQueries({ queryKey: gateKeys.events(userId) });
    forget();
    leave();
  };
  const { session, muted, toggleMute } = useScanSession(eventId);

  const { permission, request } = camera;
  useEffect(() => {
    if (permission === 'unknown') request();
  }, [permission, request]);

  const listed = events.state.status === 'ready' ? events.state.events : [];
  const event = listed.find((e) => e.id === eventId);

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
        void signOut();
      }}
      onChangeEvent={leave}
      onLostAssignment={leaveLostAssignment}
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
