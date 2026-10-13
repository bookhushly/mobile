import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';
import { Button, SectionHeader, ShellPlaceholder, Stack } from '@/shared/ui';

// Interim account tab: who is signed in, the mode switcher, sign out and delete account.
// Your details, help and legal arrive with the account task (C14).
export default function AccountRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const userId = state.status === 'signedIn' ? state.userId : null;
  const { modes, choose } = useModeSwitcher(userId);
  return (
    <ShellPlaceholder
      title="Account"
      subtitle="Your details and settings."
      identity={state.status === 'signedIn' ? state.email : ''}
      onSignOut={() => {
        signOut();
      }}
    >
      <ModeSwitcher modes={modes} current="customer" onChoose={choose} />
      <Stack gap="s2">
        <SectionHeader label="Account" />
        <Button
          variant="secondary"
          label="Delete account"
          onPress={() => {
            router.push('/delete-account');
          }}
        />
      </Stack>
    </ShellPlaceholder>
  );
}
