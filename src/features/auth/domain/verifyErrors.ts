export type VerifyError = 'badCode' | 'transient' | 'unknown';

type Raw = { status?: number; code?: string; name?: string; message?: string };

// verifyOtp errors come straight from Supabase (contract §2); the exact codes are unverified, so
// the message is matched too. Transient failures are checked first so a 503 never reads as a bad code.
export function mapVerifyError(e: Raw): VerifyError {
  if (e.status === 429 || e.name === 'AuthRetryableFetchError' || e.status === 0)
    return 'transient';
  if (typeof e.status === 'number' && e.status >= 500) return 'transient';
  const m = (e.message ?? '').toLowerCase();
  if (e.code === 'otp_expired' || e.code === 'invalid_otp') return 'badCode';
  if (m.includes('expired') || m.includes('invalid')) return 'badCode';
  if (e.status === 400 || e.status === 403) return 'badCode';
  return 'unknown';
}
