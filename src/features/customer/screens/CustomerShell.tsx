import { ShellPlaceholder } from '@/shared/ui';

type Props = { identity: string; onSignOut: () => void };

export function CustomerShell({ identity, onSignOut }: Props) {
  return (
    <ShellPlaceholder
      title="Bookhushly"
      subtitle="Browsing and booking arrive in Phase 4."
      identity={identity}
      onSignOut={onSignOut}
    />
  );
}
