import {
  redactText,
  redactUrl,
  scrubBreadcrumb,
  scrubEvent,
  scrubTransaction,
  stripQuery,
} from '@/shared/lib/scrub';

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
  it('drops touch breadcrumbs (accessibility labels can be guest names)', () => {
    expect(
      scrubBreadcrumb({
        category: 'touch',
        message: 'Touch event within element: View',
        data: { path: [{ label: 'Ada Obi, Room 204, In house' }] },
      }),
    ).toBeNull();
    expect(
      scrubEvent({ breadcrumbs: [{ category: 'touch' }, { category: 'navigation' }] }).breadcrumbs,
    ).toEqual([{ category: 'navigation' }]);
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

const TICKET = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

describe('redactUrl', () => {
  it('drops the query and masks ids, ticket codes and check-in codes in the path', () => {
    expect(redactUrl(`https://bookhushly.com/api/tickets/${TICKET}/code?x=1`)).toBe(
      'https://bookhushly.com/api/tickets/[id]/code',
    );
    expect(redactUrl('/scan/BH2.abc-DEF_1.2~x')).toBe('/scan/[code]');
    expect(redactUrl('/desk/lookup/7A2B9C01')).toBe('/desk/lookup/[code]');
    expect(redactUrl('/desk/7a2b9c01/next')).toBe('/desk/[code]/next');
    // Not a whole 8-char segment: kept.
    expect(redactUrl('/rest/v1/hotel_bookings')).toBe('/rest/v1/hotel_bookings');
    expect(redactUrl('https://bookhushly.com/api/v1')).toBe('https://bookhushly.com/api/v1');
  });
});

describe('path scrubbing', () => {
  it('masks ids in breadcrumb url, to and from', () => {
    const b = scrubBreadcrumb({
      category: 'navigation',
      data: {
        url: `https://bookhushly.com/api/tickets/${TICKET}/code`,
        from: `/tickets/${TICKET}`,
        to: '/check-in-code/7A2B9C01',
      },
    });
    expect(b?.data).toEqual({
      url: 'https://bookhushly.com/api/tickets/[id]/code',
      from: '/tickets/[id]',
      to: '/check-in-code/[code]',
    });
  });

  it('masks the request url of an event', () => {
    expect(
      scrubEvent({ request: { url: `https://a.co/api/tickets/${TICKET}/code` } }).request,
    ).toEqual({
      url: 'https://a.co/api/tickets/[id]/code',
    });
  });

  it('masks span descriptions, span url data and the transaction name', () => {
    const t = scrubTransaction({
      transaction: `/tickets/${TICKET}`,
      spans: [
        {
          op: 'http.client',
          description: `GET https://bookhushly.com/api/tickets/${TICKET}/code?a=1`,
          data: {
            url: `https://bookhushly.com/api/tickets/${TICKET}/code`,
            'http.url': `https://bookhushly.com/api/tickets/${TICKET}/code`,
            'http.query': '?a=1',
            'http.method': 'GET',
          },
        },
        { op: 'ui.load' },
      ],
      breadcrumbs: [{ category: 'xhr', data: { url: `https://a.co/api/tickets/${TICKET}/code` } }],
    });
    expect(JSON.stringify(t)).not.toContain(TICKET);
    expect(t.transaction).toBe('/tickets/[id]');
    expect(t.spans[0]).toEqual({
      op: 'http.client',
      description: 'GET https://bookhushly.com/api/tickets/[id]/code',
      data: {
        url: 'https://bookhushly.com/api/tickets/[id]/code',
        'http.url': 'https://bookhushly.com/api/tickets/[id]/code',
        'http.method': 'GET',
      },
    });
    expect(t.spans[1]).toEqual({ op: 'ui.load' });
  });
});

describe('payment references (B2)', () => {
  it('masks the reference in a payment status path, keeping the route', () => {
    expect(redactUrl('https://bookhushly.com/api/payment/status/BH_PAY_abc123?x=1')).toBe(
      'https://bookhushly.com/api/payment/status/[ref]',
    );
    expect(redactText('GET /api/payment/status/T123456789 failed')).toBe(
      'GET /api/payment/status/[ref] failed',
    );
  });

  it('masks reference fields in breadcrumb data', () => {
    const b = scrubBreadcrumb({
      category: 'fetch',
      data: {
        url: 'https://bookhushly.com/api/payment/status/T1',
        reference: 'T1',
        method: 'GET',
      },
    });
    expect(b?.data).toEqual({
      url: 'https://bookhushly.com/api/payment/status/[ref]',
      reference: '[ref]',
      method: 'GET',
    });
  });

  it('masks reference fields and status paths in spans', () => {
    const t = scrubTransaction({
      spans: [
        {
          description: 'GET https://bookhushly.com/api/payment/status/T9',
          data: { 'http.url': 'https://bookhushly.com/api/payment/status/T9', reference: 'T9' },
        },
      ],
    });
    expect(t.spans[0]).toEqual({
      description: 'GET https://bookhushly.com/api/payment/status/[ref]',
      data: { 'http.url': 'https://bookhushly.com/api/payment/status/[ref]', reference: '[ref]' },
    });
  });
});
