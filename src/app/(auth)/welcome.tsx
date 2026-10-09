import { router } from 'expo-router';
import { Linking } from 'react-native';

import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';

export default function WelcomeRoute() {
  const notice = useAuthNotice((s) => s.notice);
  const clear = useAuthNotice((s) => s.clear);
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
