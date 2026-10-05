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

describe('maxWaitMs', () => {
  it('fires at most maxWaitMs after the first call of a burst of steady calls', () => {
    const fn = jest.fn();
    const t = trailing(fn, 2_000, { maxWaitMs: 5_000 });
    const fired: number[] = [];
    fn.mockImplementation(() => fired.push(Date.now() - start));
    const start = Date.now();
    for (let s = 0; s <= 12; s++) {
      t.call();
      jest.advanceTimersByTime(1_000);
    }
    // Calls at 0..12 s; the clock is now at 13 s.
    expect(fired).toEqual([5_000, 10_000]);
    jest.advanceTimersByTime(2_000);
    expect(fired).toEqual([5_000, 10_000, 14_000]);
  });

  it('a quiet burst still fires after the plain wait, once', () => {
    const fn = jest.fn();
    const t = trailing(fn, 2_000, { maxWaitMs: 5_000 });
    t.call();
    jest.advanceTimersByTime(2_000);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('without the option, steady calls never fire until quiet', () => {
    const fn = jest.fn();
    const t = trailing(fn, 2_000);
    for (let s = 0; s <= 12; s++) {
      t.call();
      jest.advanceTimersByTime(1_000);
    }
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel also drops the max-wait deadline', () => {
    const fn = jest.fn();
    const t = trailing(fn, 2_000, { maxWaitMs: 5_000 });
    t.call();
    t.cancel();
    t.call();
    jest.advanceTimersByTime(2_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
