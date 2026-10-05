import type { ReactNode } from 'react';

import { ShellPlaceholder } from '@/shared/ui';

type Props = { identity: string; onSignOut: () => void; children?: ReactNode };

export function ReceptionistShell({ identity, onSignOut, children }: Props) {
  return (
    <ShellPlaceholder
      title="Front desk"
      subtitle="Guest check-in arrives in Phase 3."
      identity={identity}
      onSignOut={onSignOut}
    >
      {children}
    </ShellPlaceholder>
  );
}
