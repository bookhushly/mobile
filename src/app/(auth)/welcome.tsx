import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';

import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';
import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';
import { useRouteStore } from '@/features/mode/hooks/useRouteStore';

export default function WelcomeRoute() {
  const notice = useAuthNotice((s) => s.notice);
  const clear = useAuthNotice((s) => s.clear);
  // One-shot: whatever took the user away from Welcome (sign-in, sign-up) ends the notice.
  useEffect(() => clear, [clear]);
  const chooseBrowsing = useBrowseChoice((s) => s.choose);
  // Waits for the root layout to resolve the route: until then the customer group isn't there.
  // Only for browsing: a member's sign-in or sign-out can pass here with a route about to change.
  const browsing = useBrowseChoice((s) => s.browsing);
  const route = useRouteStore((s) => s.route);
  useEffect(() => {
    if (browsing === true && route === 'customer') router.replace('/explore');
  }, [browsing, route]);
  return (
    <WelcomeScreen
      notice={notice}
      onDismissNotice={clear}
      onCreateAccount={() => {
        router.push('/sign-up');
      }}
      onSignIn={() => {
        router.push('/sign-in');
      }}
      onBrowse={chooseBrowsing}
      onOpenLink={(url) => {
        void Linking.openURL(url);
      }}
    />
  );
}
