import {
  sampleRequest,
  sampleRequests,
  sampleSendQuote,
  sampleWithdraw,
} from '@/features/vendor/api/sampleRequests';
import { splitRequests } from '@/features/vendor/domain/requests';

const NOW = Date.parse('2026-11-29T07:20:00Z');

describe('sample quote flow (stands in for the web routes)', () => {
  it('sending a quote moves the request to Quoted; withdrawing moves it back to New', () => {
    expect(splitRequests(sampleRequests('logistics', NOW), NOW).new.map((r) => r.id)).toContain(
      'sample-req-2',
    );
    const sent = sampleSendQuote('logistics', 'sample-req-2', 30_000, NOW);
    expect(sent).toMatchObject({ ok: true, value: { amount: 30_000, status: 'pending' } });
    const after = splitRequests(sampleRequests('logistics', NOW), NOW);
    expect(after.quoted.map((r) => r.id)).toContain('sample-req-2');

    expect(sampleSendQuote('logistics', 'sample-req-2', 31_000, NOW)).toEqual({
      ok: false,
      error: { kind: 'conflict', code: 'already_offered' },
    });

    expect(sampleWithdraw('logistics', 'sample-req-2', NOW)).toMatchObject({
      ok: true,
      value: { status: 'withdrawn' },
    });
    expect(splitRequests(sampleRequests('logistics', NOW), NOW).new.map((r) => r.id)).toContain(
      'sample-req-2',
    );
  });

  it('a closed request refuses a quote; an answered quote cannot be withdrawn', () => {
    expect(sampleSendQuote('logistics', 'sample-req-5', 1_000, NOW)).toEqual({
      ok: false,
      error: { kind: 'conflict', code: 'request_not_open' },
    });
    expect(sampleWithdraw('logistics', 'sample-req-5', NOW)).toEqual({
      ok: false,
      error: { kind: 'conflict', code: 'offer_not_pending' },
    });
  });

  it('an unknown request is not found', () => {
    expect(sampleRequest('logistics', 'nope', NOW)).toEqual({
      ok: false,
      error: { kind: 'notFound' },
    });
  });
});
