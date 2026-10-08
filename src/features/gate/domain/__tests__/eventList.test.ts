import {
  dateTile,
  eventLabel,
  eventStatus,
  groupEvents,
  pickAutoOpen,
} from '@/features/gate/domain/eventList';
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

describe('eventStatus', () => {
  const at = (startsAt: string | null) => ev('e1', startsAt, 'Gala');
  const NOW_LOCAL = new Date(2026, 9, 8, 18, 0).getTime(); // local 18:00, 8 Oct 2026

  it('live from start for 12 hours', () => {
    expect(eventStatus(at(new Date(2026, 9, 8, 17, 0).toISOString()), NOW_LOCAL)).toBe('live');
  });
  it('later today', () => {
    expect(eventStatus(at(new Date(2026, 9, 8, 21, 0).toISOString()), NOW_LOCAL)).toBe('today');
  });
  it('another day', () => {
    expect(eventStatus(at(new Date(2026, 9, 10, 18, 0).toISOString()), NOW_LOCAL)).toBe(
      'upcoming',
    );
  });
  it('ended after 12 hours', () => {
    expect(eventStatus(at(new Date(2026, 9, 7, 18, 0).toISOString()), NOW_LOCAL)).toBe('ended');
  });
  it('no or bad date has no status', () => {
    expect(eventStatus(at(null), NOW_LOCAL)).toBeNull();
    expect(eventStatus(at('not a date'), NOW_LOCAL)).toBeNull();
  });
});

describe('dateTile', () => {
  it('month, day and weekday', () => {
    expect(dateTile(ev('e1', new Date(2026, 9, 10, 18, 0).toISOString(), 'Gala'))).toEqual({
      month: 'Oct',
      day: '10',
      weekday: 'Sat',
    });
  });
  it('null without a usable date', () => {
    expect(dateTile(ev('e1', null, 'Gala'))).toBeNull();
    expect(dateTile(ev('e1', 'nope', 'Gala'))).toBeNull();
  });
});
