import { throttle } from '@/shared/lib/throttle';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

it('runs the first call at once and folds the rest of the gap into one trailing run', () => {
  const fn = jest.fn();
  const t = throttle(fn, 5_000);
  t.call();
  expect(fn).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 10; i++) {
    jest.advanceTimersByTime(400);
    t.call();
  }
  expect(fn).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1_000);
  expect(fn).toHaveBeenCalledTimes(2);
  // Nothing more was asked for.
  jest.advanceTimersByTime(20_000);
  expect(fn).toHaveBeenCalledTimes(2);
});

it('keeps runs at least the gap apart under steady calls', () => {
  const fn = jest.fn();
  const t = throttle(fn, 5_000);
  for (let i = 0; i < 50; i++) {
    t.call();
    jest.advanceTimersByTime(300);
  }
  // 15 s of calls: leading at 0, then 5 s, 10 s, 15 s.
  expect(fn).toHaveBeenCalledTimes(4);
});

it('a call long after the last run is a fresh leading run', () => {
  const fn = jest.fn();
  const t = throttle(fn, 5_000);
  t.call();
  jest.advanceTimersByTime(6_000);
  t.call();
  expect(fn).toHaveBeenCalledTimes(2);
});

it('cancel drops a pending trailing run', () => {
  const fn = jest.fn();
  const t = throttle(fn, 5_000);
  t.call();
  t.call();
  t.cancel();
  jest.advanceTimersByTime(10_000);
  expect(fn).toHaveBeenCalledTimes(1);
});
