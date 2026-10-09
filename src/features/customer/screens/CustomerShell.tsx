import type { ReactNode } from 'react';

import { Button, SectionHeader, ShellPlaceholder, Stack } from '@/shared/ui';

type Props = {
  identity: string;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  children?: ReactNode;
};

export function CustomerShell({ identity, onSignOut, onDeleteAccount, children }: Props) {
  return (
    <ShellPlaceholder
      title="Bookhushly"
      subtitle="Browsing and booking arrive in Phase 4."
      identity={identity}
      onSignOut={onSignOut}
    >
      {children}
      <Stack gap="s2">
        <SectionHeader label="Account" />
        <Button variant="secondary" label="Delete account" onPress={onDeleteAccount} />
      </Stack>
    </ShellPlaceholder>
  );
}
