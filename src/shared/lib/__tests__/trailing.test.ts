import { trailing } from '@/shared/lib/trailing';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

it('runs once, after the last call has been quiet for the wait', () => {
  const fn = jest.fn();
  const t = trailing(fn, 2_000);
  t.call();
  jest.advanceTimersByTime(1_500);
  t.call();
  jest.advanceTimersByTime(1_999);
  expect(fn).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(fn).toHaveBeenCalledTimes(1);
});

it('cancel drops a pending run', () => {
  const fn = jest.fn();
  const t = trailing(fn, 2_000);
  t.call();
  t.cancel();
  jest.advanceTimersByTime(5_000);
  expect(fn).not.toHaveBeenCalled();
});
