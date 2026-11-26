import {
  earningsFrom,
  feeRateFrom,
  jobFrom,
  monthFrom,
  offerRequestFrom,
  requestDetailFrom,
  requestFrom,
  stayFrom,
} from '@/features/vendor/api/mapVendor';
import type { ApiJob, ApiRequest, ApiTransaction } from '@/features/vendor/schemas/vendorApi';

const NOW = Date.parse('2026-11-29T07:20:00Z');

const logi = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  id: 'r1',
  status: 'open',
  expires_at: '2026-11-29T12:20:00Z',
  created_at: '2026-11-28T10:00:00Z',
  offer_count: 2,
  service_type: 'moving',
  pickup_state: 'Lagos',
  pickup_address: 'Admiralty Way, Lekki Phase 1',
  delivery_state: 'Ogun',
  delivery_address: 'Ibara, Abeokuta',
  pickup_date: '2026-12-05',
  pickup_time: '09:00',
  item_description: 'Furniture from a 2-bed flat',
  vehicle_type: 'truck',
  fragile_items: true,
  ...over,
});

describe('requestFrom', () => {
  it('a logistics request: what, route by state, date, photo of the vehicle asked for', () => {
    expect(requestFrom(logi(), 'logistics')).toEqual({
      id: 'r1',
      requestType: 'logistics',
      title: 'Furniture from a 2-bed flat',
      summary: 'Lagos → Ogun · Sat 5 Dec',
      closesAt: '2026-11-29T12:20:00Z',
      quotes: 2,
      photo: 'truck',
      myOffer: null,
    });
  });
  it('car rental and security get their own words', () => {
    expect(
      requestFrom(
        {
          id: 'c',
          status: 'open',
          vehicle_type: 'suv',
          trip_type: 'self_drive',
          pickup_state: 'Lagos',
          pickup_date: '2026-12-05',
          return_date: '2026-12-08',
        },
        'car_rental',
      ),
    ).toMatchObject({ title: 'SUV, self-drive', summary: 'Lagos · 5–8 Dec', photo: 'suv' });
    expect(
      requestFrom(
        {
          id: 's',
          status: 'open',
          service_type: 'event_security',
          number_of_guards: 4,
          state: 'Lagos',
          start_date: '2026-12-13',
        },
        'security',
      ),
    ).toMatchObject({
      title: '4 guards, event',
      summary: 'Lagos · from Sun 13 Dec',
      photo: 'security',
    });
  });
  it('no deadline sent: no time left shown rather than a wrong one', () => {
    expect(requestFrom(logi({ expires_at: null }), 'logistics').closesAt).toBe('');
  });
});

describe('requestDetailFrom', () => {
  it('addresses, the start time in Lagos, the facts, and the customer’s own words', () => {
    const d = requestDetailFrom(
      logi({ special_instructions: 'Third floor, no lift.' }),
      'logistics',
      null,
    );
    expect(d.from).toBe('Admiralty Way, Lekki Phase 1');
    expect(d.to).toBe('Ibara, Abeokuta');
    expect(d.start).toEqual({ label: 'Pick-up', date: '2026-12-05', time: '09:00' });
    expect(d.facts.map((f) => f.title)).toEqual(['Moving', 'Truck']);
    expect(d.facts[0]?.detail).toBe('Fragile items');
    expect(d.note).toBe('Third floor, no lift.');
  });
});

describe('offerRequestFrom (Quoted and Won come from my offers)', () => {
  it('uses the request snapshot and my offer', () => {
    expect(
      offerRequestFrom({
        id: 'o1',
        request_id: 'r9',
        request_type: 'logistics',
        amount: 85_000,
        status: 'accepted',
        created_at: '2026-11-27T10:00:00Z',
        expires_at: null,
        request: {
          type: 'logistics',
          id: 'r9',
          what: 'moving',
          where: 'Lagos',
          when: '2026-12-05',
          status: 'matched',
        },
      }),
    ).toEqual({
      id: 'r9',
      requestType: 'logistics',
      title: 'Moving',
      summary: 'Lagos · Sat 5 Dec',
      closesAt: '',
      quotes: 0,
      photo: 'moving',
      myOffer: { id: 'o1', amount: 85_000, status: 'accepted', sentAt: '2026-11-27T10:00:00Z' },
    });
  });
});

const job = (over: Partial<ApiJob> = {}): ApiJob => ({
  ...logi({ status: 'paid' }),
  request_type: 'logistics',
  customer_first_name: 'Ada',
  customer_phone: '+2348031234567',
  selected_offer: { amount: 85_000 },
  payout_amount: 76_500,
  vendor_completed_at: null,
  picked_up_at: null,
  in_transit_at: null,
  delivered_at: null,
  ...over,
});

describe('jobFrom', () => {
  it('a job as the job screens use it', () => {
    expect(jobFrom(job())).toMatchObject({
      id: 'r1',
      requestType: 'logistics',
      title: 'Furniture from a 2-bed flat',
      startsAt: '2026-12-05T08:00:00.000Z',
      from: 'Admiralty Way, Lekki Phase 1',
      to: 'Ibara, Abeokuta',
      toShort: 'Ogun',
      customer: { name: 'Ada', phone: '+2348031234567' },
      paid: 85_000,
      payout: 76_500,
      status: 'paid',
    });
  });
  it('a cancelled job is not a job any more', () => {
    expect(jobFrom(job({ status: 'cancelled' }))).toBeNull();
  });
});

describe('feeRateFrom', () => {
  it('reads Bookhushly’s fee off past jobs (payout against price)', () => {
    expect(feeRateFrom([job()])).toBe(0.1);
  });
  it('no job to read it from: unknown, not guessed', () => {
    expect(feeRateFrom([])).toBeNull();
  });
});

const tx = (over: Partial<ApiTransaction>): ApiTransaction => ({
  id: 't',
  transaction_type: 'payout',
  amount: 10_000,
  status: 'completed',
  created_at: '2026-11-10T10:00:00Z',
  ...over,
});

describe('monthFrom', () => {
  it('payouts so far this month and over the same days last month, day by day', () => {
    const m = monthFrom(
      [
        tx({ id: 'a', amount: 20_000, created_at: '2026-11-02T10:00:00Z' }),
        tx({ id: 'b', amount: 30_000, created_at: '2026-11-20T10:00:00Z' }),
        tx({ id: 'c', amount: 15_000, created_at: '2026-10-05T10:00:00Z' }),
        tx({ id: 'd', amount: 99_000, created_at: '2026-10-30T10:00:00Z' }),
        tx({
          id: 'w',
          transaction_type: 'withdrawal',
          amount: 5_000,
          created_at: '2026-11-03T10:00:00Z',
        }),
      ],
      NOW,
    );
    expect(m.daysInMonth).toBe(30);
    expect(m.now).toHaveLength(29);
    expect(m.now.at(-1)).toBe(50_000);
    expect(m.then.at(-1)).toBe(15_000);
    expect(m.now[1]).toBe(20_000);
  });
});

describe('earningsFrom', () => {
  it('to withdraw is the balance; on hold is jobs paid but not yet confirmed; activity reads plainly', () => {
    const e = earningsFrom({
      balance: 326_500,
      jobs: [
        job(),
        job({ id: 'x', status: 'in_progress', payout_amount: 9_500 }),
        job({ id: 'y', status: 'completed' }),
      ],
      transactions: [
        tx({ id: 'p', description: 'Fridge to Ikorodu' }),
        tx({
          id: 'w',
          transaction_type: 'withdrawal',
          amount: 150_000,
          withdrawal_status: 'rejected',
          metadata: { bank_name: 'GTBank', account_number_last2: '42' },
        }),
      ],
      bank: { bank_name: 'GTBank', bank_account_name: 'Swift', account_number_last2: '42' },
      nowMs: NOW,
    });
    expect(e.wallet).toEqual({ available: 326_500, held: 86_000, heldJobs: 2 });
    expect(e.bank).toEqual({ name: 'GTBank', last2: '42' });
    expect(e.activity).toEqual([
      {
        id: 'p',
        kind: 'payout',
        title: 'Fridge to Ikorodu',
        at: '2026-11-10T10:00:00Z',
        amount: 10_000,
        status: 'completed',
      },
      {
        id: 'w',
        kind: 'withdrawal',
        title: 'To GTBank ••42',
        at: '2026-11-10T10:00:00Z',
        amount: 150_000,
        status: 'failed',
      },
    ]);
  });
});

describe('stayFrom (/api/vendor/bookings)', () => {
  const stay = (over: Record<string, unknown> = {}) => ({
    id: 'b1',
    booking_type: 'hotel' as const,
    status: 'confirmed',
    booking_date: '2026-11-29',
    check_out_date: '2026-12-02',
    guests: 2,
    total_amount: 186_000,
    guest_name: 'Chidi Okeke',
    payment_status: 'pay_at_hotel',
    listings: { title: 'Harbour View Hotel' },
    ...over,
  });
  it('a hotel stay, paid at the hotel', () => {
    expect(stayFrom(stay())).toEqual({
      id: 'b1',
      kind: 'hotel',
      guest: 'Chidi Okeke',
      unit: 'Harbour View Hotel',
      checkIn: '2026-11-29',
      checkOut: '2026-12-02',
      guests: 2,
      total: 186_000,
      status: 'confirmed',
      payment: 'payAtHotel',
    });
  });
  it('an apartment checked in is paid, whatever the route says about payment', () => {
    expect(
      stayFrom(stay({ booking_type: 'apartment', status: 'checked_in', payment_status: 'pending' }))
        ?.payment,
    ).toBe('paid');
  });
  it('a completed hotel stay reads as checked out; events and broken rows are left out', () => {
    expect(stayFrom(stay({ status: 'completed' }))?.status).toBe('checked_out');
    expect(stayFrom(stay({ booking_type: 'event' }))).toBeNull();
    expect(stayFrom(stay({ check_out_date: null }))).toBeNull();
  });
});
