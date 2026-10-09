import { mapVerifyError } from '@/features/auth/domain/verifyErrors';

it.each([
  [{ status: 403, code: 'otp_expired' }, 'badCode'],
  [{ status: 400, code: 'invalid_otp' }, 'badCode'],
  [{ status: 400, message: 'Token has expired or is invalid' }, 'badCode'],
  [{ status: 400 }, 'badCode'],
  [{ status: 429 }, 'transient'],
  [{ status: 503 }, 'transient'],
  [{ name: 'AuthRetryableFetchError', status: 0 }, 'transient'],
  [{ status: 418 }, 'unknown'],
  [{}, 'unknown'],
] as const)('%j -> %s', (e, out) => {
  expect(mapVerifyError(e)).toBe(out);
});
