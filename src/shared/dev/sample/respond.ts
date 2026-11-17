export type Handled = Response | null;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', Date: new Date().toUTCString(), ...headers },
  });
}

export const noContent = (): Response =>
  new Response(null, { status: 204, headers: { Date: new Date().toUTCString() } });

export async function bodyOf(init: RequestInit | undefined): Promise<Record<string, unknown>> {
  const b = init?.body;
  if (typeof b !== 'string' || b.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(b);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return await Promise.resolve({});
  }
}

export function headerOf(init: RequestInit | undefined, name: string): string | null {
  const h = init?.headers;
  if (h === undefined) return null;
  if (h instanceof Headers) return h.get(name);
  const lower = name.toLowerCase();
  const entries = Array.isArray(h) ? h : Object.entries(h);
  for (const [k, v] of entries) if (k.toLowerCase() === lower) return v;
  return null;
}

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A JWT-shaped token (unsigned: nothing verifies it but this fake). */
export function fakeJwt(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      email,
      role: 'authenticated',
      aud: 'authenticated',
      iat: now,
      exp: now + 3600,
    }),
  );
  return `${header}.${payload}.sample`;
}

/** The user id inside a fake token, or null. */
export function userOfToken(auth: string | null): string | null {
  if (auth === null || !auth.startsWith('Bearer ')) return null;
  const part = auth.slice(7).split('.')[1];
  if (part === undefined) return null;
  try {
    const payload: unknown = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    const sub: unknown =
      typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'sub') : null;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}
