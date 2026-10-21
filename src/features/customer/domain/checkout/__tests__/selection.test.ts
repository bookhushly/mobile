import type { RoomRate, TicketPackage } from '@/features/customer/schemas/listings';
import type { CustomQuestion } from '@/features/customer/schemas/checkout';
import {
  MAX_TICKETS,
  defaultRate,
  eventProblems,
  eventSubtotal,
  isFreeOrder,
  nights,
  selectionFingerprint,
  stayProblems,
  ticketLines,
  type EventSelection,
  type StaySelection,
} from '../selection';

const rate = (id: string, room: string, price: number, isDefault = false): RoomRate =>
  ({ id, room_type_id: room, price_per_night: price, is_default: isDefault }) as RoomRate;

const pkg = (name: string, price: number, remaining?: number): TicketPackage => ({
  name,
  price,
  remaining,
});

const guest = { name: 'Ada Obi', email: 'ada@example.com', phone: '08031234567' };

const stay = (over: Partial<StaySelection> = {}): StaySelection => ({
  checkIn: '2026-11-01',
  checkOut: '2026-11-03',
  adults: 2,
  children: 0,
  rateId: null,
  breakfast: {},
  airport: { on: false, type: 'pickup', code: null },
  promo: null,
  guest,
  specialRequests: '',
  ...over,
});

const event = (over: Partial<EventSelection> = {}): EventSelection => ({
  qty: { A: 1 },
  answers: {},
  promo: null,
  guest,
  ...over,
});

const rules = { today: '2026-10-21', minNights: 1, maxGuests: 4, kind: 'hotel' as const };

describe('defaultRate', () => {
  const rates = [
    rate('a', 'r1', 300),
    rate('b', 'r1', 200),
    rate('c', 'r1', 500, true),
    rate('x', 'r2', 100),
  ];
  it('prefers the requested rate of that room type', () => {
    expect(defaultRate(rates, 'r1', 'a')?.id).toBe('a');
  });
  it('ignores a requested rate from another room type', () => {
    expect(defaultRate(rates, 'r1', 'x')?.id).toBe('c');
  });
  it('falls back to is_default', () => {
    expect(defaultRate(rates, 'r1', null)?.id).toBe('c');
  });
  it('falls back to the cheapest', () => {
    expect(defaultRate([rate('a', 'r1', 300), rate('b', 'r1', 200)], 'r1', null)?.id).toBe('b');
  });
  it('returns null with no rates for the room type', () => {
    expect(defaultRate(rates, 'r9', null)).toBeNull();
    expect(defaultRate([], 'r1', null)).toBeNull();
  });
});

describe('nights', () => {
  it('counts nights', () => {
    expect(nights('2026-11-01', '2026-11-04')).toBe(3);
  });
});

describe('stayProblems', () => {
  it('accepts a valid stay', () => {
    expect(stayProblems(stay(), rules)).toEqual([]);
  });
  it('flags a past check-in', () => {
    expect(stayProblems(stay({ checkIn: '2026-10-20' }), rules)).toContain('dates');
  });
  it('allows check-in today', () => {
    expect(stayProblems(stay({ checkIn: '2026-10-21', checkOut: '2026-10-22' }), rules)).toEqual(
      [],
    );
  });
  it('flags equal dates and missing dates', () => {
    expect(stayProblems(stay({ checkOut: '2026-11-01' }), rules)).toContain('dates');
    expect(stayProblems(stay({ checkIn: null }), rules)).toContain('dates');
  });
  it('flags 91 nights but allows 90', () => {
    expect(stayProblems(stay({ checkOut: '2027-01-31' }), rules)).toContain('dates');
    expect(stayProblems(stay({ checkOut: '2027-01-30' }), rules)).toEqual([]);
  });
  it('flags fewer than the minimum nights', () => {
    const s = stay({ checkOut: '2026-11-02' });
    expect(stayProblems(s, { ...rules, minNights: 2 })).toContain('minNights');
  });
  it('flags too many guests', () => {
    expect(stayProblems(stay({ adults: 3, children: 2 }), rules)).toContain('maxGuests');
    expect(stayProblems(stay({ adults: 5 }), { ...rules, maxGuests: null })).toEqual([]);
  });
  it('flags bad guest details', () => {
    const bad = stay({ guest: { name: ' ', email: 'nope', phone: '123' } });
    expect(stayProblems(bad, rules)).toEqual(
      expect.arrayContaining(['guestName', 'guestEmail', 'guestPhone']),
    );
  });
  it('flags a phone over 20 characters as sent', () => {
    const long = stay({ guest: { ...guest, phone: '+234 803 123 4567 ext 0000 0000' } });
    expect(stayProblems(long, rules)).toContain('guestPhone');
  });
});

describe('ticketLines', () => {
  it('keeps positive integers only', () => {
    expect(ticketLines({ A: 3, B: -1, C: 0, D: 2.5, E: NaN })).toEqual({ A: 3 });
  });
});

describe('eventProblems', () => {
  const packages = [pkg('A', 1000, 5)];
  const q = (over: Partial<CustomQuestion> = {}): CustomQuestion => ({
    id: 'q1',
    label: 'Diet',
    type: 'text',
    options: [],
    required: true,
    ...over,
  });
  it('accepts a valid selection', () => {
    expect(eventProblems(event(), packages, [], false)).toEqual([]);
  });
  it('flags no tickets', () => {
    expect(eventProblems(event({ qty: { A: 0 } }), packages, [], false)).toContain('noTickets');
  });
  it('flags too many tickets', () => {
    expect(MAX_TICKETS).toBe(20);
    expect(eventProblems(event({ qty: { A: 21 } }), [pkg('A', 1)], [], false)).toContain('tooMany');
  });
  it('flags over stock', () => {
    expect(eventProblems(event({ qty: { A: 6 } }), packages, [], false)).toContain('overStock');
  });
  it('flags an empty required question only', () => {
    expect(eventProblems(event(), packages, [q()], false)).toContainEqual({ question: 'q1' });
    expect(eventProblems(event({ answers: { q1: ' x ' } }), packages, [q()], false)).toEqual([]);
    expect(eventProblems(event(), packages, [q({ required: false })], false)).toEqual([]);
  });
  it('requires a guest name only when free', () => {
    const s = event({ guest: { ...guest, name: '' } });
    expect(eventProblems(s, packages, [], false)).not.toContain('guestName');
    expect(eventProblems(s, packages, [], true)).toContain('guestName');
  });
  it('flags a bad email and phone', () => {
    const s = event({ guest: { ...guest, email: 'x', phone: '1' } });
    expect(eventProblems(s, packages, [], false)).toEqual(
      expect.arrayContaining(['guestEmail', 'guestPhone']),
    );
  });
});

describe('isFreeOrder and eventSubtotal', () => {
  it('is free when all selected packages cost 0', () => {
    expect(isFreeOrder(event({ qty: { A: 2, B: 1 } }), [pkg('A', 0), pkg('B', 0)], 0)).toBe(true);
  });
  it('is never free for a package-less priced listing', () => {
    expect(isFreeOrder(event({ qty: { x: 1 } }), [], 5000)).toBe(false);
  });
  it('is free for a package-less free listing', () => {
    expect(isFreeOrder(event({ qty: { x: 1 } }), [], 0)).toBe(true);
  });
  it('is free when a promo brings the subtotal to 0', () => {
    const s = event({ qty: { A: 1 }, promo: { codeId: 'p', discount: 2000 } });
    expect(isFreeOrder(s, [pkg('A', 2000)], 0)).toBe(true);
  });
  it('is not free when the promo leaves a balance', () => {
    const s = event({ qty: { A: 1 }, promo: { codeId: 'p', discount: 500 } });
    expect(isFreeOrder(s, [pkg('A', 2000)], 0)).toBe(false);
  });
  it('sums package prices by quantity', () => {
    expect(eventSubtotal({ A: 2, B: 1, Z: 4 }, [pkg('A', 1000), pkg('B', 500)], 0)).toBe(2500);
  });
});

describe('selectionFingerprint', () => {
  it('is stable for the same selection and changes with adults', () => {
    const a = selectionFingerprint('hotel', 'l1', 'r1', stay());
    expect(selectionFingerprint('hotel', 'l1', 'r1', stay())).toBe(a);
    expect(selectionFingerprint('hotel', 'l1', 'r1', stay({ adults: 3 }))).not.toBe(a);
  });
  it('does not depend on breakfast key order', () => {
    const a = selectionFingerprint('hotel', 'l1', 'r1', stay({ breakfast: { a: 1, b: 2 } }));
    const b = selectionFingerprint('hotel', 'l1', 'r1', stay({ breakfast: { b: 2, a: 1 } }));
    expect(a).toBe(b);
  });
});
