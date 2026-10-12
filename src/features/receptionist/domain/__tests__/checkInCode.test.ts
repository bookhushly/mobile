import { parseCheckInCode } from '@/features/receptionist/domain/checkInCode';

it.each([
  ['ab12cd34', 'AB12CD34'],
  ['  7F3B9C01 \n', '7F3B9C01'],
])('accepts %p', (raw, code) => {
  expect(parseCheckInCode(raw)).toEqual({ ok: true, code });
});
it.each([['AB12CD3'], ['AB12CD345'], ['AB12-CD3'], ['GHIJKLMN']])('rejects shape %p', (raw) => {
  expect(parseCheckInCode(raw)).toEqual({ ok: false, reason: 'shape' });
});
it('says empty for blank input', () => {
  expect(parseCheckInCode('   ')).toEqual({ ok: false, reason: 'empty' });
});
it.each([
  ['BH2.eyJhbGciOi.sig'],
  ['BH1.abc'],
  ['https://bookhushly.com/tickets/3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'],
  ['3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'],
])('recognises an event ticket %p', (raw) => {
  expect(parseCheckInCode(raw)).toEqual({ ok: false, reason: 'eventTicket' });
});
