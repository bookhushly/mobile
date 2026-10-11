// Server codes: 8 chars from a UUID's hex with a→2, e→7, upper-cased. [0-9A-F]{8} is a safe superset.
const SHAPE = /^[0-9A-F]{8}$/;
// Gate tickets (features/gate must not be imported): rotating BH1./BH2. codes or a ticket UUID/link.
const EVENT_TICKET = /^BH[12]\.|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export type CheckInCode = string & { readonly __brand: 'CheckInCode' };
export type CodeParse =
  | { ok: true; code: CheckInCode }
  | { ok: false; reason: 'empty' | 'shape' | 'eventTicket' };

export function parseCheckInCode(raw: string): CodeParse {
  const t = raw.trim();
  if (t === '') return { ok: false, reason: 'empty' };
  const up = t.toUpperCase();
  // The one allowed cast: the regex just proved the shape, so this mints the brand.
  if (SHAPE.test(up)) return { ok: true, code: up as CheckInCode };
  if (EVENT_TICKET.test(t)) return { ok: false, reason: 'eventTicket' };
  return { ok: false, reason: 'shape' };
}
