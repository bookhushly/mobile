import type { ReactNode } from 'react';

import { ShellPlaceholder } from '@/shared/ui';

type Props = { identity: string; onSignOut: () => void; children?: ReactNode };

export function CustomerShell({ identity, onSignOut, children }: Props) {
  return (
    <ShellPlaceholder
      title="Bookhushly"
      subtitle="Browsing and booking arrive in Phase 4."
      identity={identity}
      onSignOut={onSignOut}
    >
      {children}
    </ShellPlaceholder>
  );
}
