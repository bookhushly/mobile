import { apartmentBody, eventBody, hotelBody } from '../createRequest';
import type { EventSelection, StaySelection } from '../selection';

const guest = { name: 'Ada Obi', email: 'ada@example.com', phone: '08031234567' };

function stay(over: Partial<StaySelection> = {}): StaySelection {
  return {
    checkIn: '2026-11-01',
    checkOut: '2026-11-03',
    adults: 2,
    children: 1,
    rateId: 'rate-1',
    breakfast: { b1: 2, b2: 0 },
    airport: { on: false, type: 'pickup', code: null },
    promo: { codeId: 'promo-1', discount: 500 },
    guest,
    specialRequests: '  late arrival ',
    ...over,
  };
}

function event(over: Partial<EventSelection> = {}): EventSelection {
  return {
    qty: { A: 2, B: -1 },
    answers: { q1: '  vegan ', q2: '   ', q3: 'x'.repeat(600) },
    promo: { codeId: 'promo-2', discount: 100 },
    guest,
    ...over,
  };
}

describe('hotelBody', () => {
  it('sends selections, never money fields', () => {
    const body = hotelBody('rt-1', 'h-1', stay());
    const keys = Object.keys(body);
    expect(keys.some((k) => /total|amount|price/i.test(k))).toBe(false);
    expect(body).toMatchObject({
      room_type_id: 'rt-1',
      hotel_id: 'h-1',
      rate_id: 'rate-1',
      check_in_date: '2026-11-01',
      check_out_date: '2026-11-03',
      adults: 2,
      children: 1,
      breakfast_selections: [{ option_id: 'b1', quantity: 2 }],
      airport_transfer: false,
      promo_code_id: 'promo-1',
      guest_name: 'Ada Obi',
      guest_email: 'ada@example.com',
      guest_phone: '08031234567',
      special_requests: 'late arrival',
    });
    expect(keys).not.toContain('airport_transfer_type');
    expect(keys).not.toContain('airport_code');
  });

  it('omits rate, breakfast, promo and blank requests when absent', () => {
    const body = hotelBody(
      'rt-1',
      'h-1',
      stay({ rateId: null, breakfast: { b1: 0 }, promo: null, specialRequests: '  ' }),
    );
    for (const k of ['rate_id', 'breakfast_selections', 'promo_code_id', 'special_requests']) {
      expect(Object.keys(body)).not.toContain(k);
    }
  });

  it('adds airport type and code only when on', () => {
    const on = hotelBody('rt', 'h', stay({ airport: { on: true, type: 'both', code: 'LOS' } }));
    expect(on).toMatchObject({
      airport_transfer: true,
      airport_transfer_type: 'both',
      airport_code: 'LOS',
    });
    const noCode = hotelBody(
      'rt',
      'h',
      stay({ airport: { on: true, type: 'pickup', code: null } }),
    );
    expect(noCode).toMatchObject({ airport_transfer: true, airport_transfer_type: 'pickup' });
    expect(Object.keys(noCode)).not.toContain('airport_code');
  });
});

describe('apartmentBody', () => {
  it('uses number_of_guests and never sends a promo (P9)', () => {
    const body = apartmentBody('apt-1', stay());
    expect(body).toMatchObject({
      apartment_id: 'apt-1',
      check_in_date: '2026-11-01',
      check_out_date: '2026-11-03',
      number_of_guests: 3,
      airport_transfer: false,
      guest_name: 'Ada Obi',
      special_requests: 'late arrival',
    });
    const keys = Object.keys(body);
    expect(keys).not.toContain('promo_code_id');
    expect(keys).not.toContain('rate_id');
    expect(keys).not.toContain('breakfast_selections');
  });
});

describe('eventBody', () => {
  it('sends only positive integer ticket lines, trimmed answers and the promo', () => {
    const body = eventBody('l-1', event(), false);
    expect(body).toMatchObject({
      listing_id: 'l-1',
      contact_email: 'ada@example.com',
      contact_phone: '08031234567',
      ticket_details: { A: 2 },
      promo_code_id: 'promo-2',
    });
    expect(Object.keys(body)).not.toContain('contact_name');
    const answers = (body as { custom_answers: Record<string, string> }).custom_answers;
    expect(answers.q1).toBe('vegan');
    expect(Object.keys(answers)).not.toContain('q2');
    expect(answers.q3).toHaveLength(500);
  });

  it('free orders add contact_name and drop the promo', () => {
    const body = eventBody('l-1', event(), true);
    expect(body).toMatchObject({ contact_name: 'Ada Obi' });
    expect(Object.keys(body)).not.toContain('promo_code_id');
  });
});
