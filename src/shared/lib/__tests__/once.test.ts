import { onceGuard } from '@/shared/lib/once';

it('runs only the first function it is given', () => {
  const first = jest.fn();
  const second = jest.fn();
  const run = onceGuard();
  run(first);
  run(first);
  run(second);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
});

it('separate guards are independent', () => {
  const fn = jest.fn();
  onceGuard()(fn);
  onceGuard()(fn);
  expect(fn).toHaveBeenCalledTimes(2);
});
