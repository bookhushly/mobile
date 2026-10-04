import { shouldRetryQuery } from '@/shared/api/queryClient';

describe('shouldRetryQuery', () => {
  it('retries retryable api errors up to 2 times', () => {
    expect(shouldRetryQuery(0, { kind: 'network' })).toBe(true);
    expect(shouldRetryQuery(1, { kind: 'unavailable', status: 503 })).toBe(true);
    expect(shouldRetryQuery(2, { kind: 'network' })).toBe(false);
  });
  it('never retries non-retryable or unknown errors', () => {
    expect(shouldRetryQuery(0, { kind: 'forbidden' })).toBe(false);
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(false);
  });
});
