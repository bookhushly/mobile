import { redactText, scrubBreadcrumb, scrubEvent, stripQuery } from '@/shared/lib/scrub';

describe('stripQuery', () => {
  it('removes query strings and fragments from urls', () => {
    expect(stripQuery('https://x.supabase.co/rest/v1/users?id=eq.123&select=*#a')).toBe(
      'https://x.supabase.co/rest/v1/users',
    );
    expect(stripQuery('/plain/path')).toBe('/plain/path');
  });
});

describe('redactText', () => {
  it('redacts emails, bearer tokens and JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';
    const out = redactText(`user a@b.com used Bearer abc.def-ghi and ${jwt}`);
    expect(out).not.toContain('a@b.com');
    expect(out).not.toContain('abc.def-ghi');
    expect(out).not.toContain(jwt);
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'hi' })).toBeNull();
  });
  it('strips query strings from http breadcrumbs', () => {
    const b = scrubBreadcrumb({
      category: 'xhr',
      data: { url: 'https://a.co/x?id=1', method: 'GET' },
    });
    expect(b).toMatchObject({ data: { url: 'https://a.co/x' } });
  });
});

describe('scrubEvent', () => {
  it('reduces user to an id and redacts messages and exception values', () => {
    const e = scrubEvent({
      user: { id: 'u1', email: 'a@b.com', ip_address: '1.2.3.4' },
      message: 'failed for a@b.com',
      exception: { values: [{ value: 'bad token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln' }] },
      request: { url: 'https://a.co/x?code=SECRET', cookies: { a: 'b' } },
    });
    expect(e.user).toEqual({ id: 'u1' });
    expect(JSON.stringify(e)).not.toContain('a@b.com');
    expect(JSON.stringify(e)).not.toContain('eyJhbGci');
    expect(e.request).toEqual({ url: 'https://a.co/x' });
  });
});

describe('redactText masks codes and ids', () => {
  it('masks rotating ticket codes', () => {
    expect(redactText('scan BH2.abc-DEF_1.2~x failed')).toBe('scan [code] failed');
    expect(redactText('BH1.eyJhbGciOi')).toBe('[code]');
  });
  it('masks UUIDs', () => {
    expect(redactText('ticket 3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f not found')).toBe(
      'ticket [id] not found',
    );
    expect(redactText('3F2B8C4E-1A2B-4C3D-8E9F-0A1B2C3D4E5F')).toBe('[id]');
  });
});
