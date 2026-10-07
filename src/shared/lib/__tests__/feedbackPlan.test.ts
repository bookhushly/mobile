import { hapticFor } from '@/shared/lib/feedbackPlan';

it('maps each cue to a distinct haptic', () => {
  expect(hapticFor('success')).toBe('success');
  expect(hapticFor('warning')).toBe('warning');
  expect(hapticFor('error')).toBe('error');
  expect(hapticFor('retry')).toBe('light');
});
