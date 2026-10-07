import { normaliseIso, parseIsoMs } from '@/shared/lib/isoTime';

describe('parseIsoMs', () => {
  it('parses Postgres jsonb timestamps with microseconds', () => {
    expect(parseIsoMs('2026-10-07T18:04:00.123456+00:00')).toBe(
      Date.parse('2026-10-07T18:04:00.123Z'),
    );
  });
  it('parses plain ISO strings', () => {
    expect(parseIsoMs('2026-10-07T18:04:00Z')).toBe(Date.parse('2026-10-07T18:04:00Z'));
  });
  it('returns null for missing or unparseable input', () => {
    expect(parseIsoMs(null)).toBeNull();
    expect(parseIsoMs(undefined)).toBeNull();
    expect(parseIsoMs('soon')).toBeNull();
  });
});

// Node's Date.parse is lenient; Hermes is not, so the normalised string is what matters.
describe('normaliseIso', () => {
  it.each([
    ['2026-10-07T18:04:00.1+00:00', '2026-10-07T18:04:00.100+00:00', '2026-10-07T18:04:00.100Z'],
    ['2026-10-07T18:04:00.12+00:00', '2026-10-07T18:04:00.120+00:00', '2026-10-07T18:04:00.120Z'],
    ['2026-10-07T18:04:00.999999+00:00', '2026-10-07T18:04:00.999+00:00', '2026-10-07T18:04:00.999Z'],
    ['2026-10-07T18:04:00Z', '2026-10-07T18:04:00Z', '2026-10-07T18:04:00Z'],
  ])('%s → exactly three fraction digits', (raw, normal, utc) => {
    expect(normaliseIso(raw)).toBe(normal);
    expect(parseIsoMs(raw)).toBe(Date.parse(utc));
  });
});
