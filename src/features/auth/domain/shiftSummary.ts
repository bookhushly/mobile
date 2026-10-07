import type { ShiftSummary } from '@/shared/lib/signOutGuard';

export function hasShiftActivity(s: ShiftSummary): boolean {
  return s.admitted + s.used + s.refused + s.couldntCheck + s.toSync > 0;
}

// The tally counts outcomes shown, so the wording describes outcomes, not unique tickets.
export function summaryLine(s: ShiftSummary): string {
  const parts = [`${String(s.admitted)} admitted`];
  if (s.used > 0) parts.push(`${String(s.used)} already used`);
  if (s.refused > 0) parts.push(`${String(s.refused)} refused`);
  if (s.couldntCheck > 0) parts.push(`${String(s.couldntCheck)} couldn’t check`);
  if (s.toSync > 0) parts.push(`${String(s.toSync)} to sync`);
  return `This shift: ${parts.join(' · ')}`;
}
