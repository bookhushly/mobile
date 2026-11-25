import { trackMarks, trackPhase } from '@/features/customer/domain/logistics/tracking';

const none = {
  pickedUpAt: null,
  inTransitAt: null,
  deliveredAt: null,
  vendorCompletedAt: null,
  confirmed: false,
};

describe('trackPhase', () => {
  it('follows the times the company marks', () => {
    expect(trackPhase(none)).toBe('paid');
    expect(trackPhase({ ...none, pickedUpAt: 't' })).toBe('pickedUp');
    expect(trackPhase({ ...none, pickedUpAt: 't', inTransitAt: 't' })).toBe('onTheWay');
    expect(trackPhase({ ...none, deliveredAt: 't' })).toBe('delivered');
    expect(trackPhase({ ...none, confirmed: true })).toBe('confirmed');
  });

  it('counts the company marking the job done as delivered, even without a delivery time', () => {
    expect(trackPhase({ ...none, inTransitAt: 't', vendorCompletedAt: 't' })).toBe('delivered');
  });
});

describe('trackMarks', () => {
  it('marks done, now and later', () => {
    expect(trackMarks('paid')).toEqual(['current', 'later', 'later', 'later']);
    expect(trackMarks('pickedUp')).toEqual(['done', 'current', 'later', 'later']);
    expect(trackMarks('onTheWay')).toEqual(['done', 'done', 'current', 'later']);
    expect(trackMarks('delivered')).toEqual(['done', 'done', 'done', 'current']);
    expect(trackMarks('confirmed')).toEqual(['done', 'done', 'done', 'done']);
  });
});
