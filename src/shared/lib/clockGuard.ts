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

// Spec §5: suspect when the wall clock is set back > 2 min against the monotonic clock, or the
// corrected time is earlier than the last server contact. drift = Δwall − Δmono: positive drift
// (the phone slept — the monotonic clock pauses — or the clock moved forward) is never a jump.
// A new server contact re-derives the offset, which clears a jump.
export function createClockGuard(deps: Deps) {
  const maxJump = deps.maxJumpMs ?? 120_000;
  let wall = deps.wallNow();
  let mono = deps.monoNow();
  let jump: { contact: number | null } | null = null;

  /** Advances the baseline; true when the wall clock went back more than maxJump. */
  function sample(): boolean {
    const w = deps.wallNow();
    const m = deps.monoNow();
    const drift = w - wall - (m - mono);
    wall = w;
    mono = m;
    return drift < -maxJump;
  }

  return {
    state(): ClockState {
      const contact = deps.lastContactMs();
      if (sample()) jump = { contact };
      else if (jump !== null && contact !== jump.contact) jump = null;
      const now = deps.serverNow();
      const behind = contact !== null && now < contact - BEHIND_SLACK_MS;
      return {
        suspect: jump !== null || behind,
        checkedAgoMs: contact === null ? null : Math.max(0, now - contact),
      };
    },
    /**
     * Call when the app becomes active: time asleep is not a clock change, but a clock set back
     * while in the background is — record it, then reset the baseline.
     */
    rebase(): void {
      if (sample()) jump = { contact: deps.lastContactMs() };
    },
  };
}

export type ClockGuard = ReturnType<typeof createClockGuard>;
