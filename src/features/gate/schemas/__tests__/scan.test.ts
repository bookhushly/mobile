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
  it('parses an already-used body with a name or an email', () => {
    expect(usedBody.parse(fx.usedByName.body).scanned_by).toBe('Ada Gate');
    expect(usedBody.parse(fx.usedByEmail.body).scanned_by).toBe('scanner@example.com');
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
