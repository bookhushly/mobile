export type SignInError =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'rateLimited'
  | 'network'
  | 'unavailable'
  | 'unknown';

type Raw = { status?: number; code?: string; name?: string };

export function mapSignInError(e: Raw): SignInError {
  if (e.code === 'invalid_credentials') return 'invalidCredentials';
  if (e.code === 'email_not_confirmed') return 'emailNotConfirmed';
  if (e.status === 429 || e.code === 'over_request_rate_limit') return 'rateLimited';
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return 'network';
  if (typeof e.status === 'number' && e.status >= 500) return 'unavailable';
  return 'unknown';
}

export const signInCopy: Record<SignInError, string> = {
  invalidCredentials: 'That email or password is not right. Check them and try again.',
  emailNotConfirmed: 'Confirm your email first. We sent you a link when you signed up.',
  rateLimited: 'Too many attempts. Please try again in a minute.',
  network: 'We couldn’t reach the server. Check your connection and try again.',
  unavailable: 'Something went wrong on our side. Please try again shortly.',
  unknown: 'We couldn’t sign you in. Please try again.',
};
