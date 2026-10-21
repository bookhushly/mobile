// The Pay screens open right now, by booking. Resume (P5) skips a booking whose Pay screen is
// open: that screen owns its reference and settles it itself (A1). Plain module state, no React.

const open = new Map<string, number>();

const keyOf = (userId: string, kind: string, bookingId: string) => `${userId}.${kind}.${bookingId}`;

/** Marks the booking's Pay screen open; call the returned function when it closes. */
export function holdPayScreen(userId: string, kind: string, bookingId: string): () => void {
  const key = keyOf(userId, kind, bookingId);
  open.set(key, (open.get(key) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const n = (open.get(key) ?? 1) - 1;
    if (n <= 0) open.delete(key);
    else open.set(key, n);
  };
}

export function isPayScreenOpen(userId: string, kind: string, bookingId: string): boolean {
  return open.has(keyOf(userId, kind, bookingId));
}
