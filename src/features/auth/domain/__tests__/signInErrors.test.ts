import { mapSignInError } from '@/features/auth/domain/signInErrors';

it.each([
  [{ status: 400, code: 'invalid_credentials' }, 'invalidCredentials'],
  [{ status: 400, code: 'email_not_confirmed' }, 'emailNotConfirmed'],
  [{ status: 429, code: 'over_request_rate_limit' }, 'rateLimited'],
  [{ status: 429 }, 'rateLimited'],
  [{ name: 'AuthRetryableFetchError', status: 0 }, 'network'],
  [{ status: 500 }, 'unavailable'],
  [{ status: 400, code: 'something_else' }, 'unknown'],
  [{}, 'unknown'],
])('%j -> %s', (e, expected) => {
  expect(mapSignInError(e)).toBe(expected);
});
