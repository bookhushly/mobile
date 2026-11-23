import {
  askAgainDraft,
  contactFor,
  EMPTY_DRAFT,
  pickDay,
  stepReady,
  submitBody,
  tripDays,
  type CarDraft,
} from '@/features/customer/domain/carRental/carRequest';

const TODAY = '2026-12-01';

const ready: CarDraft = {
  ...EMPTY_DRAFT,
  pickupAddress: ' Allen Avenue, Ikeja ',
  pickupState: 'Lagos',
  pickupDate: '2026-12-05',
  returnDate: '2026-12-07',
  pickupTime: '09:00',
  tripType: 'chauffeur',
  passengers: 4,
};

const contact = { fullName: 'Ada Obi', email: 'ada@example.com', phone: '+2348012345678' };

describe('stepReady', () => {
  it('needs a meeting point and its state before leaving Where', () => {
    expect(stepReady('where', EMPTY_DRAFT, TODAY)).toBe(false);
    expect(stepReady('where', { ...EMPTY_DRAFT, pickupState: 'Lagos' }, TODAY)).toBe(false);
    expect(stepReady('where', ready, TODAY)).toBe(true);
  });

  it('asks for the end state once the trip goes to another state', () => {
    const going = { ...ready, destination: { state: null, address: '' } };
    expect(stepReady('where', going, TODAY)).toBe(false);
    expect(
      stepReady('where', { ...going, destination: { state: 'Ogun', address: '' } }, TODAY),
    ).toBe(true);
  });

  it('refuses a pick-up before today in Lagos', () => {
    expect(stepReady('when', { ...ready, pickupDate: '2026-11-30' }, TODAY)).toBe(false);
    expect(stepReady('when', { ...ready, returnDate: null }, TODAY)).toBe(true);
    expect(stepReady('when', ready, TODAY)).toBe(true);
  });

  it('needs driver or self-drive, and 1 to 60 passengers', () => {
    expect(stepReady('how', { ...ready, tripType: null }, TODAY)).toBe(false);
    expect(stepReady('how', { ...ready, passengers: 61 }, TODAY)).toBe(false);
    expect(stepReady('how', ready, TODAY)).toBe(true);
  });

  it('lets the car type be skipped', () => {
    expect(stepReady('car', ready, TODAY)).toBe(true);
  });

  it('accepts a blank estimate but not a zero or a word', () => {
    const hourly = { ...ready, pricingModel: 'hourly' as const };
    expect(stepReady('details', { ...hourly, durationValue: '' }, TODAY)).toBe(true);
    expect(stepReady('details', { ...hourly, durationValue: '0' }, TODAY)).toBe(false);
    expect(stepReady('details', { ...hourly, durationValue: 'six' }, TODAY)).toBe(false);
    expect(stepReady('details', { ...hourly, durationValue: '6' }, TODAY)).toBe(true);
  });

  it('is ready to check only when every step is', () => {
    expect(stepReady('check', ready, TODAY)).toBe(true);
    expect(stepReady('check', { ...ready, pickupState: null }, TODAY)).toBe(false);
  });
});

describe('pickDay', () => {
  it('starts with the pick-up, then the return', () => {
    const a = pickDay({ pickupDate: null, returnDate: null }, '2026-12-05');
    expect(a).toEqual({ pickupDate: '2026-12-05', returnDate: null });
    expect(pickDay(a, '2026-12-07')).toEqual({
      pickupDate: '2026-12-05',
      returnDate: '2026-12-07',
    });
  });

  it('makes a same-day tap a one-day trip, and an earlier tap a new pick-up', () => {
    const a = { pickupDate: '2026-12-05', returnDate: null };
    expect(pickDay(a, '2026-12-05')).toEqual({
      pickupDate: '2026-12-05',
      returnDate: '2026-12-05',
    });
    expect(pickDay(a, '2026-12-03')).toEqual({ pickupDate: '2026-12-03', returnDate: null });
  });

  it('starts again after a full range', () => {
    const full = { pickupDate: '2026-12-05', returnDate: '2026-12-07' };
    expect(pickDay(full, '2026-12-10')).toEqual({ pickupDate: '2026-12-10', returnDate: null });
  });
});

describe('tripDays', () => {
  it('counts both ends, and one day without a return', () => {
    expect(tripDays(ready)).toBe(3);
    expect(tripDays({ ...ready, returnDate: null })).toBe(1);
    expect(tripDays({ ...ready, pickupDate: null })).toBe(0);
  });
});

describe('submitBody', () => {
  it('sends what the web form sends, trimmed, with empty extras left out', () => {
    expect(submitBody(ready, contact, TODAY)).toEqual({
      trip_type: 'chauffeur',
      pickup_state: 'Lagos',
      pickup_address: 'Allen Avenue, Ikeja',
      pickup_date: '2026-12-05',
      pickup_time: '09:00',
      return_date: '2026-12-07',
      number_of_passengers: 4,
      is_urgent: false,
      full_name: 'Ada Obi',
      email: 'ada@example.com',
      phone: '+2348012345678',
    });
  });

  it('adds the optional answers when given', () => {
    const full: CarDraft = {
      ...ready,
      destination: { state: 'Ogun', address: ' Abeokuta ' },
      vehicleType: 'sedan',
      pricingModel: 'per_km',
      durationValue: '80',
      purpose: 'wedding',
      notes: ' Child seat ',
      urgent: true,
    };
    expect(submitBody(full, contact, TODAY)).toMatchObject({
      destination_state: 'Ogun',
      destination_address: 'Abeokuta',
      vehicle_type: 'sedan',
      pricing_model: 'per_km',
      duration_value: 80,
      purpose: 'wedding',
      additional_notes: 'Child seat',
      is_urgent: true,
    });
  });

  it('drops an estimate the chosen pricing does not use', () => {
    const body = submitBody(
      { ...ready, pricingModel: 'full_day', durationValue: '5' },
      contact,
      TODAY,
    );
    expect(body).not.toHaveProperty('duration_value');
  });

  it('returns null for an unfinished draft or a missing phone', () => {
    expect(submitBody({ ...ready, tripType: null }, contact, TODAY)).toBeNull();
    expect(submitBody(ready, { ...contact, phone: '' }, TODAY)).toBeNull();
  });
});

describe('contactFor', () => {
  const email = 'ada@example.com';
  it('uses the account’s name and phone', () => {
    expect(
      contactFor({ name: 'Ada', phone: '+2348012345678' }, { name: '', phone: null }, email),
    ).toEqual({
      ok: true,
      contact: { fullName: 'Ada', email, phone: '+2348012345678' },
    });
  });

  it('falls back to what was typed, and names what is still missing', () => {
    expect(
      contactFor({ name: 'Ada', phone: null }, { name: '', phone: '+2348099999999' }, email),
    ).toMatchObject({
      ok: true,
      contact: { phone: '+2348099999999' },
    });
    expect(contactFor({ name: ' ', phone: null }, { name: '', phone: null }, email)).toEqual({
      ok: false,
      missing: ['name', 'phone'],
    });
    expect(contactFor(null, { name: 'Ada', phone: null }, email)).toEqual({
      ok: false,
      missing: ['phone'],
    });
  });
});

describe('askAgainDraft', () => {
  const past = {
    tripType: 'chauffeur' as const,
    vehicleType: 'sedan' as const,
    pickupState: 'Lagos',
    pickupAddress: 'Ikeja',
    destinationState: null,
    destinationAddress: null,
    pickupDate: '2026-12-05',
    returnDate: '2026-12-07',
    pickupTime: '09:00',
    passengers: 4,
    purpose: 'wedding',
    notes: null,
    pricingModel: null,
  };

  it('keeps the answers and applies the one change', () => {
    expect(askAgainDraft(past, 'anyCar', TODAY)).toMatchObject({
      vehicleType: null,
      tripType: 'chauffeur',
      pickupDate: '2026-12-05',
    });
    expect(askAgainDraft(past, 'otherTrip', TODAY).tripType).toBe('self_drive');
    expect(askAgainDraft(past, 'otherDates', TODAY)).toMatchObject({
      pickupDate: null,
      returnDate: null,
    });
    expect(askAgainDraft(past, null, TODAY).purpose).toBe('wedding');
  });

  it('clears dates already past', () => {
    expect(askAgainDraft(past, null, '2026-12-06')).toMatchObject({
      pickupDate: null,
      returnDate: null,
    });
  });
});
