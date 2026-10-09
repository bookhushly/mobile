import { transientMessage } from '@/features/auth/domain/transientMessage';

it('says a minute when the wait is unknown', () => {
  expect(transientMessage()).toBe('We couldn’t reach Bookhushly — try again in a minute');
});

it('names the wait in seconds, singular for one', () => {
  expect(transientMessage(30)).toBe('We couldn’t reach Bookhushly — try again in 30 seconds');
  expect(transientMessage(1)).toBe('We couldn’t reach Bookhushly — try again in 1 second');
});
