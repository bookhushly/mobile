import { parseIsoMs } from '@/shared/lib/isoTime';

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
