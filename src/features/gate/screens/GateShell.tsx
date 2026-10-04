import { ShellPlaceholder } from '@/shared/ui';

type Props = { identity: string; onSignOut: () => void };

export function GateShell({ identity, onSignOut }: Props) {
  return (
    <ShellPlaceholder
      title="Gate staff"
      subtitle="Ticket scanning arrives in Phase 1."
      identity={identity}
      onSignOut={onSignOut}
    />
  );
}
