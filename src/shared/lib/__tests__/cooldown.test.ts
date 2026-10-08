import { cooldownLeft } from '@/shared/lib/cooldown';

it('counts down whole seconds and stops at zero', () => {
  expect(cooldownLeft(1_000, 1_000, 60)).toBe(60);
  expect(cooldownLeft(1_000, 1_500, 60)).toBe(60);
  expect(cooldownLeft(1_000, 31_000, 60)).toBe(30);
  expect(cooldownLeft(1_000, 61_000, 60)).toBe(0);
  expect(cooldownLeft(1_000, 999_000, 60)).toBe(0);
});

it('never exceeds the full cooldown even if the clock went backwards', () => {
  expect(cooldownLeft(10_000, 5_000, 60)).toBe(60);
});
