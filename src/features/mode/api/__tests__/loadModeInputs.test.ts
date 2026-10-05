import { loadModeInputs, type ModeDb } from '@/features/mode/api/loadModeInputs';

const okRes = (data: unknown) => Promise.resolve({ data, error: null });
const errRes = (status: number) => Promise.resolve({ data: null, error: { status } });

const db = (over: Partial<ModeDb> = {}): ModeDb => ({
  profile: () => okRes({ id: 'u', role: 'customer' }),
  hotelStaff: () => okRes(null),
  activeScanners: () => okRes([]),
  ...over,
});

describe('loadModeInputs', () => {
  it('assembles inputs', async () => {
    const r = await loadModeInputs(
      db({
        profile: () => okRes({ id: 'u', role: 'receptionist' }),
        hotelStaff: () => okRes({ hotel_id: 'h1' }),
        activeScanners: () => okRes([{ id: 's' }]),
      }),
      'u',
    );
    expect(r).toEqual({
      ok: true,
      value: { role: 'receptionist', hotelStaff: { hotelId: 'h1' }, activeScannerCount: 1 },
    });
  });
  it('a failed profile lookup is an error (never defaults to customer)', async () => {
    const r = await loadModeInputs(db({ profile: () => errRes(503) }), 'u');
    expect(r.ok).toBe(false);
  });
  it('a failed scanner or hotel lookup is also an error, not "no assignment"', async () => {
    expect((await loadModeInputs(db({ activeScanners: () => errRes(500) }), 'u')).ok).toBe(false);
    expect((await loadModeInputs(db({ hotelStaff: () => errRes(500) }), 'u')).ok).toBe(false);
  });
  it('a profile with an unexpected shape is a validation error', async () => {
    const r = await loadModeInputs(db({ profile: () => okRes({ id: 'u', role: 'owner' }) }), 'u');
    expect(r).toEqual({ ok: false, error: { kind: 'validation' } });
  });
  it('a missing profile row (null) is not found, not customer', async () => {
    const r = await loadModeInputs(db({ profile: () => okRes(null) }), 'u');
    expect(r).toEqual({ ok: false, error: { kind: 'notFound' } });
  });
});
