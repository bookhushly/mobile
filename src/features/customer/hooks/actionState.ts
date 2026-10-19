import { useCallback, useRef, useState } from 'react';

import type { ActionOutcome } from '@/features/customer/domain/actionOutcome';

/** One action's sheet: idle → sending → (checking, when a lost answer is re-read) → outcome. */
export type ActionState<T> =
  | { kind: 'idle' }
  | { kind: 'sending' }
  /** A lost answer is being settled by re-reading the booking (never by posting again). */
  | { kind: 'checking' }
  | ActionOutcome<T>;

const IDLE = { kind: 'idle' } as const;

export type Step<T> = (show: (s: ActionState<T>) => void) => Promise<ActionOutcome<T>>;

/**
 * Single flight: while a step runs, another `run` (a double tap, a second sheet) is ignored and
 * resolves to null. Nothing here ever re-posts on its own.
 */
export function useAction<T>(): {
  state: ActionState<T>;
  run: (first: ActionState<T>, step: Step<T>) => Promise<ActionOutcome<T> | null>;
  /** Back to idle (closing the sheet); ignored while a step runs. */
  reset: () => void;
} {
  const [state, setState] = useState<ActionState<T>>(IDLE);
  const busy = useRef(false);
  const run = useCallback(
    async (first: ActionState<T>, step: Step<T>): Promise<ActionOutcome<T> | null> => {
      if (busy.current) return null;
      busy.current = true;
      setState(first);
      try {
        const o = await step(setState);
        setState(o);
        return o;
      } catch {
        // A step only throws on a bug; the POST may still have landed, so never "refused".
        const o: ActionOutcome<T> = { kind: 'uncertain' };
        setState(o);
        return o;
      } finally {
        busy.current = false;
      }
    },
    [],
  );
  const reset = useCallback(() => {
    if (!busy.current) setState(IDLE);
  }, []);
  return { state, run, reset };
}
