// R3: after an uncertain answer the desk re-reads the booking instead of posting again.
export type Reconciled = 'done' | 'notDone' | 'elsewhere';
const GRACE_MS = 60_000;

type CheckInState = { booking_status: string | null; checked_in_at: string | null };
type CheckOutState = { booking_status: string | null; checked_out_at: string | null };

function byUs(sentAtMs: number, at: string | null): Reconciled {
  const ms = at === null ? NaN : Date.parse(at);
  return Number.isFinite(ms) && ms >= sentAtMs - GRACE_MS ? 'done' : 'elsewhere';
}

export function reconcileCheckIn(sentAtMs: number, row: CheckInState | null): Reconciled {
  if (row === null) return 'notDone';
  if (row.booking_status !== 'checked_in' && row.booking_status !== 'checked_out') return 'notDone';
  return byUs(sentAtMs, row.checked_in_at);
}

export function reconcileCheckOut(sentAtMs: number, row: CheckOutState | null): Reconciled {
  if (row === null || row.booking_status !== 'checked_out') return 'notDone';
  return byUs(sentAtMs, row.checked_out_at);
}

export function reconcileReassign(
  row: { hotel_rooms: { id: string } | null } | null,
  targetRoomId: string,
): 'done' | 'notDone' {
  return row?.hotel_rooms?.id === targetRoomId ? 'done' : 'notDone';
}
