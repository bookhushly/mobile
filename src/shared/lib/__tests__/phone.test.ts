import { formatNigerianPhone, NIGERIAN_STATES, parseNigerianPhone } from '@/shared/lib/phone';

it.each([
  ['0803 123 4567', '+2348031234567'],
  ['8031234567', '+2348031234567'],
  ['+234 803 123 4567', '+2348031234567'],
  ['2348031234567', '+2348031234567'],
  ['07012345678', '+2347012345678'],
  ['0903-123-4567', '+2349031234567'],
  ['(0803) 123.4567', '+2348031234567'],
])('normalises %s to E.164', (raw, e164) => {
  expect(parseNigerianPhone(raw)).toEqual({ ok: true, e164 });
});

it.each([
  ['080312345'],
  ['05031234567'],
  ['+44 7700 900123'],
  [''],
  ['0803 123 456a'],
  ['+2340803123456'],
])('rejects %s', (raw) => {
  expect(parseNigerianPhone(raw)).toEqual({ ok: false });
});

it('formats E.164 for display in the local style', () => {
  expect(formatNigerianPhone('+2348031234567')).toBe('0803 123 4567');
  expect(formatNigerianPhone('+2347012345678')).toBe('0701 234 5678');
});

it('leaves a number it cannot read unchanged', () => {
  expect(formatNigerianPhone('+447700900123')).toBe('+447700900123');
});

it('lists the 36 states and the FCT alphabetically', () => {
  expect(NIGERIAN_STATES).toHaveLength(37);
  expect([...NIGERIAN_STATES].sort((a, b) => a.localeCompare(b))).toEqual(NIGERIAN_STATES);
  expect(NIGERIAN_STATES).toEqual(expect.arrayContaining(['Akwa Ibom', 'Cross River', 'FCT']));
  expect(new Set(NIGERIAN_STATES).size).toBe(37);
});
