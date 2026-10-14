import type { StaleSession } from '@/features/customer/api/customerDb';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';

export type WriteError = 'stale' | 'transient';
export type WriteOutcome = 'ok' | WriteError;

// C13: a write that touched no rows may be a stale session (RLS); withSessionRetry refreshes once.
export async function refreshSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.refreshSession();
    return data.session !== null;
  } catch {
    return false;
  }
}

export function writeOutcome(r: Result<number, ApiError | StaleSession>): WriteOutcome {
  if (r.ok) return 'ok';
  // A 401 after the client's own refresh is the same story: the session is gone.
  return r.error.kind === 'staleSession' || r.error.kind === 'auth' ? 'stale' : 'transient';
}

/** Saved-listing writes (spec D9): `auth`/`forbidden` (RLS WITH CHECK, 42501) is a stale session too. */
export function savedOutcome(r: Result<void, ApiError | StaleSession>): WriteOutcome {
  if (r.ok) return 'ok';
  const k = r.error.kind;
  return k === 'staleSession' || k === 'auth' || k === 'forbidden' ? 'stale' : 'transient';
}

/** True only while `userId` is still the signed-in account (a local write after sign-out is dropped). */
export async function isSignedInAs(userId: string): Promise<boolean> {
  if (userId === '') return false;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id === userId;
  } catch {
    return false;
  }
}
