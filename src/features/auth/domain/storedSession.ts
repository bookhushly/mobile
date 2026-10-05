import type { SessionLite } from './authState';

export function parseStoredSession(raw: string | null): SessionLite | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { user, refresh_token: refresh } = parsed as { user?: unknown; refresh_token?: unknown };
    if (typeof refresh !== 'string' || refresh.length === 0) return null;
    if (typeof user !== 'object' || user === null) return null;
    const { id, email } = user as { id?: unknown; email?: unknown };
    if (typeof id !== 'string' || id.length === 0) return null;
    return { userId: id, email: typeof email === 'string' ? email : '' };
  } catch {
    return null;
  }
}

/**
 * The SDK reports no session on a cold start when the access token has expired and the refresh
 * cannot reach the server (offline). The refresh token is still on disk, so the user is still
 * signed in — only an explicit sign-out or a rejected refresh token ends that.
 */
export async function resolveInitialSession(
  sdkSession: SessionLite | null,
  readStored: () => Promise<string | null>,
): Promise<SessionLite | null> {
  if (sdkSession) return sdkSession;
  try {
    return parseStoredSession(await readStored());
  } catch {
    return null;
  }
}
