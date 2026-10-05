import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLastEvent } from '@/features/gate/hooks/useLastEvent';
import { useScannableEvents } from '@/features/gate/hooks/useScannableEvents';
import { EventListScreen } from '@/features/gate/screens/EventListScreen';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

export default function GateEventsRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const userId = state.status === 'signedIn' ? state.userId : null;
  const { modes, choose } = useModeSwitcher(userId);
  const events = useScannableEvents(userId);
  const last = useLastEvent(userId);
  const { remember } = last;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { refresh } = events;
  const reload = useCallback(() => {
    setNowMs(Date.now());
    void refresh();
  }, [refresh]);

  const open = useCallback(
    (eventId: string) => {
      remember(eventId);
      router.push({ pathname: '/gate/[eventId]', params: { eventId } });
    },
    [remember],
  );

  return (
    <EventListScreen
      state={last.loaded ? events.state : { status: 'loading' }}
      nowMs={nowMs}
      lastEventId={last.lastEventId}
      identity={state.status === 'signedIn' ? state.email : ''}
      refreshing={events.refreshing}
      onRefresh={reload}
      onRetry={reload}
      onOpen={open}
      onSignOut={() => {
        void signOut();
      }}
      header={<ModeSwitcher modes={modes} current="gate" onChoose={choose} />}
    />
  );
}
