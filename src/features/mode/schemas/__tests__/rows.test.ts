import { hotelStaffRow, profileRow, scannerRows } from '@/features/mode/schemas/rows';

describe('mode row schemas', () => {
  it('accepts a valid profile and rejects an unknown role', () => {
    expect(profileRow.safeParse({ id: 'u', role: 'customer', name: null }).success).toBe(true);
    expect(profileRow.safeParse({ id: 'u', role: 'owner' }).success).toBe(false);
  });
  it('accepts null hotel staff and a hotel row', () => {
    expect(hotelStaffRow.safeParse(null).success).toBe(true);
    expect(hotelStaffRow.safeParse({ hotel_id: 'h' }).success).toBe(true);
  });
  it('accepts an empty scanner list', () => {
    expect(scannerRows.safeParse([]).success).toBe(true);
  });
});
