import { Linking } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { WebOnlyScreen } from '@/features/mode/screens/StatusScreens';
import { WEB_URL } from '@/shared/config/store';

export default function WebOnly() {
  const auth = useAuth((s) => s.state);
  const signOut = useSignOut();
  return (
    <WebOnlyScreen
      email={auth.status === 'signedIn' ? auth.email : ''}
      onOpenWeb={() => {
        void Linking.openURL(WEB_URL);
      }}
      onSignOut={() => {
        signOut();
      }}
    />
  );
}
