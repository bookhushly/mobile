import { hotelStaffRow, profileRow } from '@/features/mode/schemas/rows';

describe('mode row schemas', () => {
  it('accepts a valid profile and rejects an unknown role', () => {
    expect(profileRow.safeParse({ id: 'u', role: 'customer', name: null }).success).toBe(true);
    expect(profileRow.safeParse({ id: 'u', role: 'owner' }).success).toBe(false);
  });
  it('hotel staff is a list of rows (empty, one or several hotels)', () => {
    expect(hotelStaffRow.safeParse([]).success).toBe(true);
    expect(hotelStaffRow.safeParse([{ hotel_id: 'h' }]).success).toBe(true);
    expect(hotelStaffRow.safeParse([{ hotel_id: 'a' }, { hotel_id: 'b' }]).success).toBe(true);
    expect(hotelStaffRow.safeParse(null).success).toBe(false);
  });
});
