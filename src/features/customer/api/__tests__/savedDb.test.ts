import {
  createSavedDb,
  SAVED_COLUMNS,
  SAVED_KINDS,
  type SavedClient,
  type SavedQuery,
} from '@/features/customer/api/savedDb';

jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));

type Res = { data: unknown; error?: { code?: string } | null; status?: number };
type Op = { op: string; args: unknown[] };

// Each database call takes the next scripted response, in order.
function fake(script: Res[], refreshResult: boolean | Error = true) {
  const queue = [...script];
  const ops: Op[] = [];
  const next = () => {
    const r = queue.shift();
    if (!r) throw new Error('unscripted call');
    return { data: r.data, error: r.error ?? null, status: r.status ?? 200 };
  };
  // One response per select, whether it ends in maybeSingle() or is awaited as a list.
  const query = (log: Op): SavedQuery => {
    const row = next();
    const q: SavedQuery = Object.assign(Promise.resolve(row), {
      eq: (c: string, v: string) => {
        log.args.push(['eq', c, v]);
        return q;
      },
      order: (c: string, opts: { ascending: boolean }) => {
        log.args.push(['order', c, opts]);
        return q;
      },
      limit: (n: number) => {
        log.args.push(['limit', n]);
        return q;
      },
      maybeSingle: () => {
        log.args.push(['maybeSingle']);
        return Promise.resolve(row);
      },
    });
    return q;
  };
  const client: SavedClient = {
    from: (table) => ({
      select: (columns) => {
        const log: Op = { op: 'select', args: [table, columns] };
        ops.push(log);
        return query(log);
      },
      upsert: (values, opts) => ({
        select: (c) => {
          ops.push({ op: 'upsert', args: [table, values, opts, c] });
          return Promise.resolve(next());
        },
      }),
      delete: () => ({
        match: (m) => ({
          select: (c) => {
            ops.push({ op: 'delete', args: [table, m, c] });
            return Promise.resolve(next());
          },
        }),
      }),
    }),
  };
  const refresh = jest.fn(() =>
    refreshResult instanceof Error ? Promise.reject(refreshResult) : Promise.resolve(refreshResult),
  );
  return { db: createSavedDb(client, refresh), ops, refresh, left: () => queue.length };
}

const KEY = { listingId: 'h1', kind: 'hotel' as const };
const ITEM = { ...KEY, title: 'Eko Hotel', image: 'https://x/1.jpg', location: 'Lagos' };
const MATCH = { user_id: 'u1', listing_id: 'h1', listing_type: 'hotel' };
const ROW = { id: 's1' };

describe('saved kinds', () => {
  it('are the web’s values, all allowed by the saved_listings CHECK (hotel|apartment|event|listing)', () => {
    expect(SAVED_KINDS).toEqual(['hotel', 'apartment', 'event']);
    const dbCheck = ['hotel', 'apartment', 'event', 'listing'];
    for (const k of SAVED_KINDS) expect(dbCheck).toContain(k);
  });
});

describe('savedDb.list', () => {
  it('selects the own rows, newest first, at most 500 (web parity), and maps them', async () => {
    const { db, ops } = fake([
      {
        data: [
          {
            id: 's1',
            listing_id: 'h1',
            listing_type: 'hotel',
            listing_title: 'Eko',
            listing_image: null,
            listing_location: 'Lagos',
            created_at: '2026-10-13T10:00:00Z',
          },
          // A legacy 'listing' row (allowed by the CHECK) is skipped, not fatal.
          { id: 's2', listing_id: 'x', listing_type: 'listing', created_at: '2026-10-12' },
        ],
      },
    ]);
    const r = await db.list('u1');
    expect(SAVED_COLUMNS).toBe(
      'id, listing_id, listing_type, listing_title, listing_image, listing_location, created_at',
    );
    expect(ops).toEqual([
      {
        op: 'select',
        args: [
          'saved_listings',
          SAVED_COLUMNS,
          ['eq', 'user_id', 'u1'],
          ['order', 'created_at', { ascending: false }],
          ['limit', 500],
        ],
      },
    ]);
    expect(r).toEqual({
      ok: true,
      value: [
        {
          id: 's1',
          listingId: 'h1',
          kind: 'hotel',
          title: 'Eko',
          image: null,
          location: 'Lagos',
          createdAt: '2026-10-13T10:00:00Z',
        },
      ],
    });
  });
});

describe('savedDb.isSaved', () => {
  it('looks up the one row by user, listing and type', async () => {
    const { db, ops } = fake([{ data: ROW }]);
    expect(await db.isSaved('u1', KEY)).toEqual({ ok: true, value: true });
    expect(ops[0]?.args).toEqual([
      'saved_listings',
      'id',
      ['eq', 'user_id', 'u1'],
      ['eq', 'listing_id', 'h1'],
      ['eq', 'listing_type', 'hotel'],
      ['maybeSingle'],
    ]);
  });
});

describe('savedDb.save', () => {
  it('upserts the snapshot idempotently and selects id', async () => {
    const { db, ops, refresh } = fake([{ data: [ROW] }]);
    expect(await db.save('u1', ITEM)).toEqual({ ok: true, value: undefined });
    expect(ops).toEqual([
      {
        op: 'upsert',
        args: [
          'saved_listings',
          {
            user_id: 'u1',
            listing_id: 'h1',
            listing_type: 'hotel',
            listing_title: 'Eko Hotel',
            listing_image: 'https://x/1.jpg',
            listing_location: 'Lagos',
          },
          { onConflict: 'user_id,listing_id,listing_type', ignoreDuplicates: true },
          'id',
        ],
      },
    ]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('an Undo keeps the row’s original created_at, so it returns to its place (F5)', async () => {
    const { db, ops } = fake([{ data: [ROW] }]);
    await db.save('u1', { ...ITEM, createdAt: '2026-10-01T09:00:00.000Z' });
    expect(ops[0]?.args[1]).toMatchObject({ created_at: '2026-10-01T09:00:00.000Z' });
  });

  it('0 rows but the row is there (already saved, e.g. a retry after a lost response) is success', async () => {
    const { db, refresh, left } = fake([{ data: [] }, { data: ROW }]);
    expect(await db.save('u1', ITEM)).toEqual({ ok: true, value: undefined });
    expect(refresh).not.toHaveBeenCalled();
    expect(left()).toBe(0);
  });

  it('0 rows and no row: refresh once and retry', async () => {
    const { db, refresh, ops } = fake([{ data: [] }, { data: null }, { data: [ROW] }]);
    expect(await db.save('u1', ITEM)).toEqual({ ok: true, value: undefined });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(ops.map((o) => o.op)).toEqual(['upsert', 'select', 'upsert']);
  });

  it('still nothing after the refresh is staleSession', async () => {
    const { db, refresh } = fake([{ data: [] }, { data: null }, { data: [] }, { data: null }]);
    expect(await db.save('u1', ITEM)).toEqual({ ok: false, error: { kind: 'staleSession' } });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a refresh that fails or throws is staleSession without a retry', async () => {
    for (const r of [false, new Error('offline')]) {
      const { db, ops } = fake([{ data: [] }, { data: null }], r);
      expect(await db.save('u1', ITEM)).toEqual({ ok: false, error: { kind: 'staleSession' } });
      expect(ops).toHaveLength(2);
    }
  });

  it('an error is returned as is, never retried as stale', async () => {
    const { db, refresh } = fake([{ data: null, error: { code: '503' }, status: 503 }]);
    expect(await db.save('u1', ITEM)).toEqual({
      ok: false,
      error: { kind: 'unavailable', status: 503 },
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('savedDb.unsave', () => {
  it('deletes by match and selects id', async () => {
    const { db, ops, refresh } = fake([{ data: [ROW] }]);
    expect(await db.unsave('u1', KEY)).toEqual({ ok: true, value: undefined });
    expect(ops).toEqual([{ op: 'delete', args: ['saved_listings', MATCH, 'id'] }]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('0 rows: only a fresh session can tell "already gone" from "can’t see it", so refresh and retry', async () => {
    const { db, refresh, ops } = fake([{ data: [] }, { data: [] }, { data: null }]);
    expect(await db.unsave('u1', KEY)).toEqual({ ok: true, value: undefined });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(ops.map((o) => o.op)).toEqual(['delete', 'delete', 'select']);
  });

  it('a retry that finds the row and deletes it is success', async () => {
    const { db } = fake([{ data: [] }, { data: [ROW] }]);
    expect(await db.unsave('u1', KEY)).toEqual({ ok: true, value: undefined });
  });

  it('the row still there after a fresh retry is staleSession (never a false "removed")', async () => {
    const { db } = fake([{ data: [] }, { data: [] }, { data: ROW }]);
    expect(await db.unsave('u1', KEY)).toEqual({ ok: false, error: { kind: 'staleSession' } });
  });

  it('a failed refresh is staleSession', async () => {
    const { db, ops } = fake([{ data: [] }], false);
    expect(await db.unsave('u1', KEY)).toEqual({ ok: false, error: { kind: 'staleSession' } });
    expect(ops).toHaveLength(1);
  });
});
