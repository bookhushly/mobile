import { createVendorDb, type SupabaseLike } from '@/features/vendor/api/vendorDb';

jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));

function fakeClient(res: { data: unknown; error: { code?: string } | null; status?: number }) {
  const calls: { table?: string; columns?: string; eq?: [string, string] } = {};
  const client: SupabaseLike = {
    from(table) {
      calls.table = table;
      return {
        select(columns) {
          calls.columns = columns;
          return {
            eq(column, value) {
              calls.eq = [column, value];
              return { maybeSingle: () => Promise.resolve({ status: 200, ...res }) };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

const row = {
  id: 'v1',
  business_name: ' Swift Haulage ',
  business_category: 'logistics',
  approved: true,
  status: 'approved',
  suspended_at: null,
  rejection_reason: null,
};

describe('vendorDb.me', () => {
  it('reads only the safe columns of the caller’s own row', async () => {
    const { client, calls } = fakeClient({ data: row, error: null });
    const r = await createVendorDb(client).me('u1');
    expect(calls.table).toBe('vendors');
    expect(calls.eq).toEqual(['user_id', 'u1']);
    expect(calls.columns).not.toMatch(/bank|nin|phone|tax/);
    expect(r).toEqual({
      ok: true,
      value: { id: 'v1', name: 'Swift Haulage', kind: 'logistics', standing: { kind: 'ready' } },
    });
  });

  it('no row yet -> null, not an error', async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await createVendorDb(client).me('u1')).toEqual({ ok: true, value: null });
  });

  it('a malformed row is a validation error', async () => {
    const { client } = fakeClient({ data: { id: 1 }, error: null });
    expect(await createVendorDb(client).me('u1')).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
  });

  it('a database failure maps to the typed taxonomy', async () => {
    const { client } = fakeClient({ data: null, error: { code: 'PGRST301' }, status: 401 });
    const r = await createVendorDb(client).me('u1');
    expect(r.ok).toBe(false);
  });
});
