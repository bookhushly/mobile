// Whole seconds left in a resend cooldown, clamped to [0, seconds].
export function cooldownLeft(startedAtMs: number, nowMs: number, seconds: number): number {
  const left = seconds - Math.floor((nowMs - startedAtMs) / 1000);
  return Math.max(0, Math.min(seconds, left));
}
