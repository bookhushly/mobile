export type SignInError =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'accountClosed'
  | 'rateLimited'
  | 'network'
  | 'unavailable'
  | 'unknown';

type Raw = { status?: number; code?: string; name?: string; message?: string };

export function mapSignInError(e: Raw): SignInError {
  if (e.code === 'invalid_credentials') return 'invalidCredentials';
  // The `email_not_confirmed` code is unverified on our project; web matches the message.
  if (e.code === 'email_not_confirmed' || e.message === 'Email not confirmed') {
    return 'emailNotConfirmed';
  }
  // A deleted account is banned server-side (contract §1.5).
  if (e.code === 'user_banned') return 'accountClosed';
  if (e.status === 429 || e.code === 'over_request_rate_limit') return 'rateLimited';
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return 'network';
  if (typeof e.status === 'number' && e.status >= 500) return 'unavailable';
  return 'unknown';
}

export const signInCopy: Record<SignInError, string> = {
  invalidCredentials: 'That email or password is not right. Check them and try again.',
  emailNotConfirmed: 'Confirm your email first. We’ll send you a code.',
  accountClosed: 'This account was closed. Contact support@bookhushly.com if this is a mistake.',
  rateLimited: 'Too many attempts. Please try again in a minute.',
  network: 'We couldn’t reach the server. Check your connection and try again.',
  unavailable: 'Something went wrong on our side. Please try again shortly.',
  unknown: 'We couldn’t sign you in. Please try again.',
};
