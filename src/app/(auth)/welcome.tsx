import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';

import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';

export default function WelcomeRoute() {
  const notice = useAuthNotice((s) => s.notice);
  const clear = useAuthNotice((s) => s.clear);
  // One-shot: whatever took the user away from Welcome (sign-in, sign-up) ends the notice.
  useEffect(() => clear, [clear]);
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
      onOpenLink={(url) => {
        void Linking.openURL(url);
      }}
    />
  );
}
