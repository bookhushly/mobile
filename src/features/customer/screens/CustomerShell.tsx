import { ShellPlaceholder } from '@/shared/ui';

type Props = { identity: string; onSignOut: () => void; footnote?: string };

export function CustomerShell({ identity, onSignOut, footnote }: Props) {
  return (
    <ShellPlaceholder
      title="Bookhushly"
      subtitle="Browsing and booking arrive in Phase 4."
      identity={identity}
      onSignOut={onSignOut}
      {...(footnote ? { footnote } : {})}
    />
  );
}
