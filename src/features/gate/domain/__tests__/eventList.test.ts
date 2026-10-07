import { eventLabel, groupEvents, pickAutoOpen } from '@/features/gate/domain/eventList';
import type { ScannableEvent } from '@/shared/api/scannableEvents';

const NOW = Date.parse('2026-10-05T12:00:00.000Z');
const ev = (id: string, startsAt: string | null, title: string | null = id): ScannableEvent => ({
  id,
  title,
  startsAt,
  location: null,
});

describe('groupEvents', () => {
  it('upcoming soonest first, unknown dates last; earlier most recent first', () => {
    const g = groupEvents(
      [
        ev('late', '2026-10-20T18:00:00Z'),
        ev('nodate', null),
        ev('soon', '2026-10-06T18:00:00Z'),
        ev('old', '2026-09-01T18:00:00Z'),
        ev('older', '2026-08-01T18:00:00Z'),
      ],
      NOW,
    );
    expect(g.upcoming.map((e) => e.id)).toEqual(['soon', 'late', 'nodate']);
    expect(g.earlier.map((e) => e.id)).toEqual(['old', 'older']);
  });
  it('an event that started within the last 12 h is still upcoming (doors are open)', () => {
    const g = groupEvents([ev('tonight', '2026-10-05T02:00:00Z')], NOW);
    expect(g.upcoming).toHaveLength(1);
  });
});

describe('pickAutoOpen', () => {
  it('reopens the last event only if it is still listed', () => {
    const list = [ev('a', null), ev('b', null)];
    expect(pickAutoOpen(list, 'b', NOW)).toBe('b');
    expect(pickAutoOpen(list, 'gone', NOW)).toBeNull();
    expect(pickAutoOpen(list, null, NOW)).toBeNull();
  });
  it('never reopens a past event, only an upcoming one', () => {
    const list = [ev('lastWeek', '2026-09-28T18:00:00Z'), ev('tonight', '2026-10-05T18:00:00Z')];
    expect(pickAutoOpen(list, 'lastWeek', NOW)).toBeNull();
    expect(pickAutoOpen(list, 'tonight', NOW)).toBe('tonight');
  });
});

describe('eventLabel', () => {
  it('falls back to a short id for hidden listings', () => {
    expect(eventLabel(ev('11111111-2222-4333-8444-555555555555', null, null))).toBe(
      'Event · 11111111',
    );
    expect(eventLabel(ev('x', null, 'Afro Night'))).toBe('Afro Night');
  });
});
