import {
  checkStatus,
  eventCreated,
  initialized,
  parseCustomQuestions,
  paymentState,
  promoResult,
  roomAvailability,
  serviceCharge,
  stayCreated,
  verified,
} from '@/features/customer/schemas/checkout';

const stay = {
  booking: {
    id: 'b1',
    type: 'hotel',
    status: 'confirmed',
    payment_status: 'pending',
    total: '45000.50',
    currency: 'NGN',
    nights: 2,
    check_in_date: '2026-11-01',
    check_out_date: '2026-11-03',
    guest_name: 'Ada',
    guest_email: 'ada@example.com',
    guest_phone: '0800',
    pricing: { room_total: 40000, airport_fee: null, discount_amount: '0' },
    created_at: '2026-10-21T10:00:00Z',
    hotel: { id: 'h1', name: 'Grand' },
    extra_key: 1,
  },
  next: { payment: { type: 'hotel', id: 'b1', amount: 45000.5, endpoint: '/api/payment/initialize' } },
};

describe('stayCreated', () => {
  it('parses a valid body, coercing numeric strings', () => {
    const r = stayCreated.parse(stay);
    expect(r.booking.total).toBe(45000.5);
    expect(r.booking.pricing.discount_amount).toBe(0);
    expect(r.booking.pricing.airport_fee).toBeNull();
    expect(r.booking.hotel?.name).toBe('Grand');
  });
  it('accepts replayed', () => {
    expect(stayCreated.parse({ ...stay, replayed: true }).replayed).toBe(true);
  });
  it('fails without the payment hand-off', () => {
    expect(stayCreated.safeParse({ booking: stay.booking }).success).toBe(false);
  });
  it('accepts null names for hotel, room type and apartment (C3)', () => {
    const r = stayCreated.parse({
      ...stay,
      booking: {
        ...stay.booking,
        hotel: { id: 'h1', name: null },
        room_type: { id: 'rt1', name: null },
        apartment: { id: 'a1', name: null },
      },
    });
    expect(r.booking.hotel?.name).toBeNull();
    expect(r.booking.room_type?.name).toBeNull();
    expect(r.booking.apartment?.name).toBeNull();
  });
});

describe('eventCreated', () => {
  const body = {
    booking: {
      id: 'e1',
      status: 'pending',
      payment_status: 'pending',
      total_amount: '5000',
      created_at: 'x',
      listing_id: 'l1',
      ticket_details: { Regular: 2 },
    },
  };
  it('parses', () => { expect(eventCreated.parse(body).booking.total_amount).toBe(5000); });
  it('fails without an id', () => {
    expect(eventCreated.safeParse({ booking: { ...body.booking, id: undefined } }).success).toBe(false);
  });
});

describe('roomAvailability', () => {
  it('parses', () => {
    expect(roomAvailability.parse({ totalRooms: 5, bookedCount: 2, freeRooms: 3, available: true }).freeRooms).toBe(3);
  });
  it('fails without available', () => {
    expect(roomAvailability.safeParse({ totalRooms: 5, bookedCount: 2, freeRooms: 3 }).success).toBe(false);
  });
});

describe('promoResult', () => {
  it('parses a valid code', () => {
    const r = promoResult.parse({ valid: true, code_id: 'c', code: 'X', discount_amount: 100, discounted_total: '900' });
    expect(r.valid && r.discounted_total).toBe(900);
  });
  it('parses an invalid code', () => {
    const r = promoResult.parse({ valid: false, error: 'Expired' });
    expect(!r.valid && r.error).toBe('Expired');
  });
  it('fails a valid code missing code_id', () => {
    expect(promoResult.safeParse({ valid: true, code: 'X', discount_amount: 1, discounted_total: 1 }).success).toBe(false);
  });
});

describe('serviceCharge', () => {
  it('parses null and a charge', () => {
    expect(serviceCharge.parse({ charge: null }).charge).toBeNull();
    const c = serviceCharge.parse({
      charge: { charge_type: 'percentage', charge_value: '2.5', enabled: true, label: null },
    }).charge;
    expect(c?.charge_value).toBe(2.5);
  });
  it('fails without the charge key', () => {
    expect(serviceCharge.safeParse({}).success).toBe(false);
  });
});

describe('initialized', () => {
  const payment = {
    id: 'p1',
    reference: 'ref',
    amount: 46000,
    base_amount: 45000,
    service_charge_amount: 1000,
    service_charge_label: null,
    currency: 'NGN',
    payment_url: 'https://checkout.paystack.com/abc',
  };
  it('parses', () => { expect(initialized.parse({ success: true, payment }).payment.reference).toBe('ref'); });
  it('rejects a non-https payment_url', () => {
    expect(initialized.safeParse({ success: true, payment: { ...payment, payment_url: 'http://x.com/a' } }).success).toBe(false);
  });
  it('fails without a reference', () => {
    expect(initialized.safeParse({ success: true, payment: { ...payment, reference: undefined } }).success).toBe(false);
  });
});

describe('checkStatus', () => {
  it('picks each branch', () => {
    const p = { reference: 'r', status: 'completed', created_at: 'x' };
    const paid = checkStatus.parse({ hasPaid: true, payment: p });
    expect(paid.hasPaid).toBe(true);
    const pending = checkStatus.parse({ hasPaid: false, hasPending: true, payment: p });
    expect(!pending.hasPaid && pending.hasPending).toBe(true);
    const none = checkStatus.parse({ hasPaid: false, hasPending: false });
    expect(!none.hasPaid && none.hasPending).toBe(false);
  });
  it('fails a pending branch without its payment', () => {
    expect(checkStatus.safeParse({ hasPaid: false, hasPending: true }).success).toBe(false);
  });
});

describe('verified', () => {
  it('parses with and without payment', () => {
    expect(verified.parse({ verified: false, status: 'pending' }).verified).toBe(false);
    expect(verified.parse({ verified: true, status: 'completed', payment: { reference: 'r', status: 'completed' } }).payment?.reference).toBe('r');
  });
  it('fails without verified', () => {
    expect(verified.safeParse({ status: 'x' }).success).toBe(false);
  });
});

describe('paymentState', () => {
  const payment = { reference: 'r', status: 'completed', fulfilled: true, request_type: 'hotel' };
  it('parses with a request or null', () => {
    expect(paymentState.parse({ payment, request: null }).request).toBeNull();
    expect(paymentState.parse({ payment, request: { id: 'b', status: null, payment_status: 'completed' } }).request?.id).toBe('b');
  });
  it('fails without fulfilled', () => {
    expect(paymentState.safeParse({ payment: { ...payment, fulfilled: undefined }, request: null }).success).toBe(false);
  });
});

describe('parseCustomQuestions', () => {
  it('reads a JSON string, taking label from question', () => {
    const r = parseCustomQuestions('[{"id":"q1","question":"Size?","type":"select","options":["S","M"],"required":true}]');
    expect(r).toEqual([{ id: 'q1', label: 'Size?', type: 'select', options: ['S', 'M'], required: true }]);
  });
  it('reads an array, falling back to label then text, with defaults', () => {
    const r = parseCustomQuestions([{ id: 'a', label: 'L', type: 'text' }, { id: 'b', text: 'T', type: 'textarea' }]);
    expect(r.map((q) => q.label)).toEqual(['L', 'T']);
    expect(r[0]).toMatchObject({ options: [], required: false });
  });
  it('returns [] for invalid JSON or non-arrays', () => {
    expect(parseCustomQuestions('not json')).toEqual([]);
    expect(parseCustomQuestions(null)).toEqual([]);
    expect(parseCustomQuestions({})).toEqual([]);
  });
  it('reads an unknown or missing type as text, never dropping the question (D1)', () => {
    const r = parseCustomQuestions([
      { id: 'x', label: 'L', type: 'date', required: true },
      { id: 'y', label: 'M' },
    ]);
    expect(r).toEqual([
      { id: 'x', label: 'L', type: 'text', options: [], required: true },
      { id: 'y', label: 'M', type: 'text', options: [], required: false },
    ]);
  });
  it('accepts required as true or "true" only (D1)', () => {
    const r = parseCustomQuestions([
      { id: 'a', label: 'A', type: 'text', required: 'true' },
      { id: 'b', label: 'B', type: 'text', required: 'false' },
      { id: 'c', label: 'C', type: 'text', required: 1 },
    ]);
    expect(r.map((q) => q.required)).toEqual([true, false, false]);
  });
  it('an empty question falls back to label (D1)', () => {
    expect(parseCustomQuestions([{ id: 'a', question: '', label: 'Diet', type: 'text' }])[0]?.label).toBe('Diet');
  });
});
