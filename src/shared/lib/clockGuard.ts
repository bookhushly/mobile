export type ClockState = { suspect: boolean; checkedAgoMs: number | null };

type Deps = {
  wallNow: () => number;
  // Monotonic and per-process (performance.now): it pauses in deep sleep, hence rebase().
  monoNow: () => number;
  serverNow: () => number;
  lastContactMs: () => number | null;
  maxJumpMs?: number;
};

// The Date header has 1 s resolution and requests take time; don't call that "behind".
const BEHIND_SLACK_MS = 5_000;

// Spec §5: suspect when the wall clock jumps > 2 min against the monotonic clock in this session,
// or the corrected time is earlier than the last server contact. A new server contact re-derives
// the offset, which clears a jump.
export function createClockGuard(deps: Deps) {
  const maxJump = deps.maxJumpMs ?? 120_000;
  let wall = deps.wallNow();
  let mono = deps.monoNow();
  let jump: { contact: number | null } | null = null;

  return {
    state(): ClockState {
      const w = deps.wallNow();
      const m = deps.monoNow();
      const drift = w - wall - (m - mono);
      wall = w;
      mono = m;
      const contact = deps.lastContactMs();
      if (Math.abs(drift) > maxJump) jump = { contact };
      else if (jump !== null && contact !== jump.contact) jump = null;
      const now = deps.serverNow();
      const behind = contact !== null && now < contact - BEHIND_SLACK_MS;
      return {
        suspect: jump !== null || behind,
        checkedAgoMs: contact === null ? null : Math.max(0, now - contact),
      };
    },
    /** Call when the app becomes active: time asleep is not a clock change. */
    rebase(): void {
      wall = deps.wallNow();
      mono = deps.monoNow();
    },
  };
}

export type ClockGuard = ReturnType<typeof createClockGuard>;
