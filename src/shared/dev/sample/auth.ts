import { tables } from './db';
import { bodyOf, fakeJwt, headerOf, json, noContent, userOfToken, type Handled } from './respond';
import { uid } from './time';

/** Typing this password shows the "wrong email or password" error. Any other password works. */
export const WRONG_PASSWORD = 'wrong-password';
/** The code that confirms a new account or a password reset. Any other 6 digits fail. */
export const SAMPLE_CODE = '123456';

function userObject(row: Record<string, unknown>) {
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: row.name },
    identities: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  };
}

function session(row: Record<string, unknown>) {
  const id = String(row.id);
  return {
    access_token: fakeJwt(id, String(row.email)),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `sample-refresh-${id}`,
    user: userObject(row),
  };
}

const byEmail = (email: unknown) =>
  tables.users?.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase());
const byId = (id: string | null) => tables.users?.find((u) => u.id === id);

const refused = (code: string, msg: string, status = 400) =>
  json({ code: status, error_code: code, msg, message: msg }, status);

/** Supabase Auth (GoTrue) endpoints the app uses. */
export async function handleAuth(
  path: string,
  params: URLSearchParams,
  init?: RequestInit,
): Promise<Handled> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const auth = headerOf(init, 'Authorization');
  if (path === '/token') {
    const body = await bodyOf(init);
    const grant = params.get('grant_type');
    if (grant === 'password') {
      const user = byEmail(body.email);
      if (user === undefined || body.password === WRONG_PASSWORD)
        return refused('invalid_credentials', 'Invalid login credentials');
      return json(session(user));
    }
    if (grant === 'refresh_token') {
      const id = String(body.refresh_token).replace('sample-refresh-', '');
      const user = byId(id);
      return user === undefined
        ? refused('refresh_token_not_found', 'Invalid Refresh Token')
        : json(session(user));
    }
  }
  if (path === '/verify' && method === 'POST') {
    const body = await bodyOf(init);
    if (body.token !== SAMPLE_CODE)
      return refused('otp_expired', 'Token has expired or is invalid', 403);
    const user = byEmail(body.email);
    return user === undefined
      ? refused('otp_expired', 'Token has expired or is invalid', 403)
      : json(session(user));
  }
  if (path === '/user') {
    const user = byId(userOfToken(auth));
    if (user === undefined) return refused('bad_jwt', 'invalid JWT', 401);
    if (method === 'PUT') return json(userObject(user));
    return json(userObject(user));
  }
  if (path === '/logout') return noContent();
  return null;
}

/** POST /api/auth/signup: creates the user here, confirmed by SAMPLE_CODE. */
export function signUp(body: Record<string, unknown>): Response {
  const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
  if (byEmail(email) !== undefined) return json({ error: 'email_taken' }, 409);
  const id = uid(100 + (tables.users?.length ?? 0));
  tables.users?.push({
    id,
    email,
    name: typeof body.name === 'string' ? body.name : '',
    role: 'customer',
    phone: null,
    state: null,
    address: null,
  });
  return json({ ok: true, user: { id, email } });
}
