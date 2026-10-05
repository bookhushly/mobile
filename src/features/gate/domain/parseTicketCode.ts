import { z } from 'zod';

// Minted only here; everything downstream (queue keys, the scan POST) takes a TicketCode.
const ticketCode = z.string().min(1).max(400).brand<'TicketCode'>();
export type TicketCode = z.infer<typeof ticketCode>;

export type ParsedCode = { kind: 'rotating' | 'static'; value: TicketCode };

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ROTATING_RE = /^BH[12]\./;

export function parseTicketCode(raw: string): ParsedCode | null {
  const value = raw.trim();
  if (ROTATING_RE.test(value)) {
    const r = ticketCode.safeParse(value);
    return r.success ? { kind: 'rotating', value: r.data } : null;
  }
  if (value.length > 400) return null;
  const match = UUID_RE.exec(value);
  if (!match) return null;
  const r = ticketCode.safeParse(match[0].toLowerCase());
  return r.success ? { kind: 'static', value: r.data } : null;
}
