import { fx, TICKET_ID } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody, summaryBody, usedBody } from '@/features/gate/schemas/scan';

describe('scan schemas', () => {
  it('parses an admission and strips guest contact details', () => {
    const r = admitBody.parse(fx.admitted.body);
    expect(r.ticket).toEqual({
      id: TICKET_ID,
      ticket_type: 'Regular',
      ticket_index: 2,
      checked_in_at: '2026-10-05T18:04:00.000Z',
    });
    expect(r.booking).toEqual({
      id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      total_tickets: 3,
      checked_in_count: 2,
    });
    expect(JSON.stringify(r)).not.toMatch(/guest@example|2348000000000/);
  });
  it('accepts any 200 with ok: true, falling back to null for drifted fields', () => {
    const r = admitBody.parse({ ok: true, ticket: { id: 5 }, booking: 'x' });
    expect(r.ticket).toEqual({
      id: null,
      ticket_type: null,
      ticket_index: null,
      checked_in_at: null,
    });
    expect(r.booking).toBeNull();
    expect(admitBody.parse({ ok: true })).toEqual({ ok: true, ticket: null, booking: null });
    expect(admitBody.safeParse({ ok: false }).success).toBe(false);
  });
  it('still strips unknown keys from a drifted admission', () => {
    const r = admitBody.parse({
      ok: true,
      contact_email: 'guest@example.com',
      ticket: { ticket_type: 7, contact_phone: '+2348000000000' },
      booking: { total_tickets: 'two', contact_email: 'guest@example.com' },
    });
    expect(JSON.stringify(r)).not.toMatch(/guest@example|2348000000000/);
    expect(r.booking).toEqual({ id: null, total_tickets: null, checked_in_count: null });
  });
  it('parses an already-used body with a name or an email', () => {
    expect(usedBody.parse(fx.usedByName.body).scanned_by).toBe('Ada Gate');
    expect(usedBody.parse(fx.usedByEmail.body).scanned_by).toBe('scanner@example.com');
  });
  it('parses by_me as true, false, null or absent', () => {
    expect(usedBody.parse(fx.usedByMe.body).by_me).toBe(true);
    expect(usedBody.parse(fx.usedNotMe.body).by_me).toBe(false);
    expect(usedBody.parse({ ...fx.usedByName.body, by_me: null }).by_me).toBeNull();
    expect(usedBody.parse(fx.usedByName.body).by_me).toBeUndefined();
  });
  it('rejects a refusal body as already-used', () => {
    expect(usedBody.safeParse(fx.notFound.body).success).toBe(false);
  });
  it('parses the summary and treats a null scanned_by_me as false', () => {
    const r = summaryBody.parse(fx.summary.body);
    expect(r.admitted).toBe(41);
    expect(r.recent.map((x) => x.scanned_by_me)).toEqual([true, false]);
  });
});
