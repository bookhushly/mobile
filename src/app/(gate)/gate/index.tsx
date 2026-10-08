import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useLastEvent } from '@/features/gate/hooks/useLastEvent';
import { useOfflineLists } from '@/features/gate/hooks/useOfflineLists';
import { useScannableEvents } from '@/features/gate/hooks/useScannableEvents';
import { EventListScreen } from '@/features/gate/screens/EventListScreen';
import { AccountSheet } from '@/features/gate/ui/AccountSheet';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

export default function GateEventsRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const userId = state.status === 'signedIn' ? state.userId : null;
  const { modes, choose } = useModeSwitcher(userId);
  const events = useScannableEvents(userId);
  const last = useLastEvent(userId);
  const offlineLists = useOfflineLists(userId);
  const { remember } = last;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [account, setAccount] = useState(false);
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
    <>
      <EventListScreen
        state={last.loaded ? events.state : { status: 'loading' }}
        nowMs={nowMs}
        lastEventId={last.lastEventId}
        offlineLists={offlineLists}
        refreshing={events.refreshing}
        onRefresh={reload}
        onRetry={reload}
        onOpen={open}
        onOpenAccount={() => {
          setAccount(true);
        }}
      />
      <AccountSheet
        visible={account}
        email={state.status === 'signedIn' ? state.email : ''}
        modeSwitcher={<ModeSwitcher modes={modes} current="gate" onChoose={choose} />}
        onSignOut={() => {
          setAccount(false);
          signOut();
        }}
        onClose={() => {
          setAccount(false);
        }}
      />
    </>
  );
}
