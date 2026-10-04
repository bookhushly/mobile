import { useModeState } from '@/features/mode/hooks/useModeState';
import type { Mode } from '@/features/mode/domain/resolveMode';

export function useModeSwitcher(userId: string | null): {
  modes: Mode[];
  choose: (m: Mode) => void;
} {
  const { state, choose } = useModeState(userId);
  const modes =
    state.status === 'ready' && state.resolution.kind === 'modes' ? state.resolution.modes : [];
  return { modes, choose };
}
