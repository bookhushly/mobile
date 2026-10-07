import { shouldShowNotAssigned } from '@/features/gate/domain/lostAssignment';

const EV = '11111111-1111-4111-8111-111111111111';
const other = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'B',
  startsAt: null,
  location: null,
};
const mine = { id: EV, title: 'A', startsAt: null, location: null };

describe('shouldShowNotAssigned', () => {
  it('shows when the summary was forbidden and the fresh list no longer has the event', () => {
    expect(
      shouldShowNotAssigned({ userId: 'u1', summaryForbidden: true, events: [other], eventId: EV }),
    ).toBe(true);
    expect(
      shouldShowNotAssigned({ userId: 'u1', summaryForbidden: true, events: [], eventId: EV }),
    ).toBe(true);
  });
  it('does not show while the event is still listed', () => {
    expect(
      shouldShowNotAssigned({
        userId: 'u1',
        summaryForbidden: true,
        events: [other, mine],
        eventId: EV,
      }),
    ).toBe(false);
  });
  it('does not show when the refetch failed (no list)', () => {
    expect(
      shouldShowNotAssigned({ userId: 'u1', summaryForbidden: true, events: null, eventId: EV }),
    ).toBe(false);
  });
  it('does not show without a forbidden summary', () => {
    expect(
      shouldShowNotAssigned({ userId: 'u1', summaryForbidden: false, events: [], eventId: EV }),
    ).toBe(false);
  });
  it('does not show without a signed-in user (the list was fetched for no one)', () => {
    expect(
      shouldShowNotAssigned({ userId: null, summaryForbidden: true, events: [], eventId: EV }),
    ).toBe(false);
  });
});
