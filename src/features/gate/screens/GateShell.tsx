import type { ReactNode } from 'react';

import { ShellPlaceholder } from '@/shared/ui';

type Props = { identity: string; onSignOut: () => void; children?: ReactNode };

export function GateShell({ identity, onSignOut, children }: Props) {
  return (
    <ShellPlaceholder
      title="Gate staff"
      subtitle="Ticket scanning arrives in Phase 1."
      identity={identity}
      onSignOut={onSignOut}
    >
      {children}
    </ShellPlaceholder>
  );
}
