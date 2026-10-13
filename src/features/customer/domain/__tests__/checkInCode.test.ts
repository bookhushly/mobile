import { showCheckInCode, spacedCode } from '@/features/customer/domain/checkInCode';
import type { HotelBookingRow } from '@/features/customer/schemas/bookings';

type Row = Pick<HotelBookingRow, 'payment_status' | 'booking_status' | 'check_in_code'>;
const row = (p: Partial<Row> = {}): Row => ({
  payment_status: 'completed',
  booking_status: 'confirmed',
  check_in_code: 'AB12CD34',
  ...p,
});

describe('showCheckInCode', () => {
  it('shows for a paid, live booking with a code', () => {
    expect(showCheckInCode(row())).toBe(true);
    expect(showCheckInCode(row({ booking_status: 'checked_in' }))).toBe(true);
    expect(showCheckInCode(row({ booking_status: null }))).toBe(true);
  });

  it.each<Partial<Row>>([
    { payment_status: 'pending' },
    { payment_status: 'failed' },
    { payment_status: 'refunded' },
    { payment_status: null },
    { booking_status: 'cancelled' },
    { booking_status: 'checked_out' },
    { check_in_code: null },
    { check_in_code: '  ' },
  ])('hides for %o', (p) => {
    expect(showCheckInCode(row(p))).toBe(false);
  });
});

describe('spacedCode', () => {
  it('splits an 8-character code in two', () => {
    expect(spacedCode('AB12CD34')).toBe('AB12 CD34');
  });

  it('leaves other lengths alone, trimmed', () => {
    expect(spacedCode(' ABC ')).toBe('ABC');
  });
});
