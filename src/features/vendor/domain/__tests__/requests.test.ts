import {
  offerLine,
  parseAmount,
  quoteBreakdown,
  quoteProblem,
  splitRequests,
  type VendorRequest,
} from '@/features/vendor/domain/requests';

const NOW = Date.parse('2026-11-29T07:20:00Z');
const OPEN = '2026-11-29T12:20:00Z';
const CLOSED = '2026-11-29T06:00:00Z';

const req = (id: string, over: Partial<VendorRequest> = {}): VendorRequest => ({
  id,
  requestType: 'logistics',
  title: id,
  summary: 's',
  closesAt: OPEN,
  quotes: 0,
  photo: 'truck',
  myOffer: null,
  ...over,
});
const offer = (status: NonNullable<VendorRequest['myOffer']>['status']) => ({
  id: 'o',
  amount: 85_000,
  status,
  sentAt: '2026-11-29T06:00:00Z',
});

describe('splitRequests', () => {
  it('new: open and not quoted; quoted: your pending (or unanswered) quotes; won: chosen', () => {
    const r = splitRequests(
      [
        req('fresh'),
        req('quoted', { myOffer: offer('pending') }),
        req('won', { myOffer: offer('accepted') }),
        req('lost', { myOffer: offer('rejected') }),
        req('expired', { myOffer: offer('expired') }),
      ],
      NOW,
    );
    expect(r.new.map((x) => x.id)).toEqual(['fresh']);
    expect(r.quoted.map((x) => x.id)).toEqual(['quoted', 'lost', 'expired']);
    expect(r.won.map((x) => x.id)).toEqual(['won']);
  });

  it('a closed request you never quoted drops off; a withdrawn quote on an open one is new again', () => {
    const r = splitRequests(
      [
        req('gone', { closesAt: CLOSED }),
        req('again', { myOffer: offer('withdrawn') }),
        req('gone-withdrawn', { closesAt: CLOSED, myOffer: offer('withdrawn') }),
      ],
      NOW,
    );
    expect(r.new.map((x) => x.id)).toEqual(['again']);
    expect(r.quoted).toEqual([]);
  });

  it('new requests: the one closing soonest first', () => {
    const r = splitRequests(
      [req('later', { closesAt: '2026-11-30T12:00:00Z' }), req('sooner', { closesAt: OPEN })],
      NOW,
    );
    expect(r.new.map((x) => x.id)).toEqual(['sooner', 'later']);
  });
});

describe('offerLine', () => {
  it.each([
    ['pending', 'Your quote ₦85,000 · waiting for the customer'],
    ['accepted', 'Chosen · ₦85,000'],
    ['rejected', 'Not chosen · ₦85,000'],
    ['expired', 'Expired before they chose · ₦85,000'],
    ['withdrawn', 'You withdrew ₦85,000'],
  ] as const)('%s', (status, line) => {
    expect(offerLine(offer(status))).toBe(line);
  });
});

describe('parseAmount', () => {
  it('reads naira as typed, with commas or spaces', () => {
    expect(parseAmount('85,000')).toBe(85_000);
    expect(parseAmount(' 85 000 ')).toBe(85_000);
  });
  it('blank is null; anything else is NaN', () => {
    expect(parseAmount('')).toBeNull();
    expect(Number.isNaN(parseAmount('85k'))).toBe(true);
    expect(Number.isNaN(parseAmount('85.50'))).toBe(true);
  });
});

describe('quoteProblem', () => {
  it('a whole naira amount from ₦1,000 to ₦100,000,000', () => {
    expect(quoteProblem('', '')).toBe('Enter your price');
    expect(quoteProblem('abc', '')).toBe('Enter a whole amount in naira');
    expect(quoteProblem('999', '')).toBe('The lowest quote is ₦1,000');
    expect(quoteProblem('100000001', '')).toBe('The highest quote is ₦100,000,000');
    expect(quoteProblem('85000', '')).toBeNull();
  });
  it('the message has a limit', () => {
    expect(quoteProblem('85000', 'x'.repeat(1001))).toBe('Keep the message under 1,000 characters');
  });
});

describe('quoteBreakdown', () => {
  it('the fee and what you keep, in whole naira', () => {
    expect(quoteBreakdown(85_000, 0.1)).toEqual({ fee: 8_500, receive: 76_500 });
    expect(quoteBreakdown(12_345, 0.1)).toEqual({ fee: 1_235, receive: 11_110 });
  });
});
