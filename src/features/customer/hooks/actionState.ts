import { useCallback, useRef, useState } from 'react';

import type { ActionOutcome } from '@/features/customer/domain/actionOutcome';

/** One action's sheet: idle → sending → (checking, when a lost answer is re-read) → outcome. */
/**
 * A cancel or transfer whose answer was lost, settled as not done: the re-read shows the booking
 * unchanged and the answer can no longer land (the server failed it, or too long has passed).
 * A new POST is allowed.
 */
export type NotDone = { kind: 'notDone' };

/** What an action step settles to: the server's outcome, or `notDone` after a re-read. */
export type ActionResult<T> = ActionOutcome<T> | NotDone;

export type ActionState<T> =
  | { kind: 'idle' }
  | { kind: 'sending' }
  /** A lost answer is being settled by re-reading the booking (never by posting again). */
  | { kind: 'checking' }
  | ActionResult<T>;

const IDLE = { kind: 'idle' } as const;

export type Step<T> = (show: (s: ActionState<T>) => void) => Promise<ActionResult<T>>;

/**
 * Single flight: while a step runs, another `run` (a double tap, a second sheet) is ignored and
 * resolves to null. Nothing here ever re-posts on its own.
 */
export function useAction<T>(): {
  state: ActionState<T>;
  run: (first: ActionState<T>, step: Step<T>) => Promise<ActionResult<T> | null>;
  /** Back to idle (closing the sheet); ignored while a step runs. */
  reset: () => void;
} {
  const [state, setState] = useState<ActionState<T>>(IDLE);
  const busy = useRef(false);
  const run = useCallback(
    async (first: ActionState<T>, step: Step<T>): Promise<ActionResult<T> | null> => {
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
