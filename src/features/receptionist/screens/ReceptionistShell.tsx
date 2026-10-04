import { ShellPlaceholder } from '@/shared/ui';

type Props = { identity: string; onSignOut: () => void };

export function ReceptionistShell({ identity, onSignOut }: Props) {
  return (
    <ShellPlaceholder
      title="Front desk"
      subtitle="Guest check-in arrives in Phase 3."
      identity={identity}
      onSignOut={onSignOut}
    />
  );
}
