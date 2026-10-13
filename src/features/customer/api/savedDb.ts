import { z } from 'zod';

import { read, type DbRow, type StaleSession } from '@/features/customer/api/customerDb';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';

// saved_listings under RLS (spec D9): own rows, unique (user_id, listing_id, listing_type). The
// web's POST toggles (a retry would unsave, §9 Customer 4b (f)), so the app writes directly.

/** The web's values; the DB CHECK also allows a legacy 'listing', which the app never writes. */
export const SAVED_KINDS = ['hotel', 'apartment', 'event'] as const;
export type SavedKind = (typeof SAVED_KINDS)[number];
export type SavedKey = { listingId: string; kind: SavedKind };
export type SavedInput = SavedKey & {
  title: string | null;
  image: string | null;
  location: string | null;
};
export type SavedItem = SavedInput & { id: string; createdAt: string };

export const SAVED_COLUMNS =
  'id, listing_id, listing_type, listing_title, listing_image, listing_location, created_at';
export const SAVED_LIMIT = 200;
const TABLE = 'saved_listings';
const UPSERT = { onConflict: 'user_id,listing_id,listing_type', ignoreDuplicates: true };

export type SavedQuery = PromiseLike<DbRow> & {
  eq(column: string, value: string): SavedQuery;
  order(column: string, opts: { ascending: boolean }): SavedQuery;
  limit(count: number): SavedQuery;
  maybeSingle(): PromiseLike<DbRow>;
};
// Writes end with `.select('id')`: RLS turns a stale session into "0 rows", not an error.
type Returning = { select(columns: 'id'): PromiseLike<DbRow> };
export type SavedClient = {
  from(table: typeof TABLE): {
    select(columns: string): SavedQuery;
    upsert(
      values: Record<string, string | null>,
      opts: { onConflict: string; ignoreDuplicates: boolean },
    ): Returning;
    delete(): { match(query: Record<string, string>): Returning };
  };
};

export type SavedWriteError = ApiError | StaleSession;

export type SavedDb = {
  list(userId: string): Promise<Result<SavedItem[], ApiError>>;
  isSaved(userId: string, key: SavedKey): Promise<Result<boolean, ApiError>>;
  save(userId: string, item: SavedInput): Promise<Result<void, SavedWriteError>>;
  unsave(userId: string, key: SavedKey): Promise<Result<void, SavedWriteError>>;
};

const text = z.string().nullable().catch(null);
const savedRow = z.object({
  id: z.string(),
  listing_id: z.string(),
  listing_type: z.enum(SAVED_KINDS),
  listing_title: text,
  listing_image: text,
  listing_location: text,
  created_at: z.string(),
});
// A row the app can't open (legacy 'listing') is skipped, never fatal.
const savedRows = z.array(z.unknown()).transform((rows) =>
  rows.flatMap((r): SavedItem[] => {
    const p = savedRow.safeParse(r);
    if (!p.success) return [];
    const s = p.data;
    return [
      {
        id: s.id,
        listingId: s.listing_id,
        kind: s.listing_type,
        title: s.listing_title,
        image: s.listing_image,
        location: s.listing_location,
        createdAt: s.created_at,
      },
    ];
  }),
);
const maybeId = z.object({ id: z.string() }).nullable();
const touched = z.array(z.object({ id: z.string() }));

const stale = (): Result<never, StaleSession> => err({ kind: 'staleSession' });

async function refreshed(refresh: () => Promise<boolean>): Promise<boolean> {
  try {
    return await refresh();
  } catch {
    // A refresh that throws (offline, revoked) is the same answer as one that fails.
    return false;
  }
}

// The C13 zero-row guard, made safe for idempotent writes: 0 rows can mean "already done" or "a
// session RLS can't see through". A retry after a lost response must never flip the state.
export function createSavedDb(client: SavedClient, refresh: () => Promise<boolean>): SavedDb {
  const match = (userId: string, key: SavedKey) => ({
    user_id: userId,
    listing_id: key.listingId,
    listing_type: key.kind,
  });
  const count = async (q: PromiseLike<DbRow>): Promise<Result<number, ApiError>> => {
    const r = await read(q, touched);
    return r.ok ? ok(r.value.length) : r;
  };

  const isSaved: SavedDb['isSaved'] = async (userId, key) => {
    const r = await read(
      client
        .from(TABLE)
        .select('id')
        .eq('user_id', userId)
        .eq('listing_id', key.listingId)
        .eq('listing_type', key.kind)
        .maybeSingle(),
      maybeId,
    );
    return r.ok ? ok(r.value !== null) : r;
  };

  // true = the row is saved (written now, or already there and visible to this session).
  const trySave = async (userId: string, item: SavedInput): Promise<Result<boolean, ApiError>> => {
    const w = await count(
      client
        .from(TABLE)
        .upsert(
          {
            ...match(userId, item),
            listing_title: item.title,
            listing_image: item.image,
            listing_location: item.location,
          },
          UPSERT,
        )
        .select('id'),
    );
    if (!w.ok) return w;
    // ignoreDuplicates returns no row for an existing save: seeing it proves both the save and
    // the session (a stale session sees nothing).
    return w.value >= 1 ? ok(true) : isSaved(userId, item);
  };

  const remove = (userId: string, key: SavedKey) =>
    count(client.from(TABLE).delete().match(match(userId, key)).select('id'));

  return {
    list: (userId) =>
      read(
        client
          .from(TABLE)
          .select(SAVED_COLUMNS)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(SAVED_LIMIT),
        savedRows,
      ),
    isSaved,
    async save(userId, item) {
      const first = await trySave(userId, item);
      if (!first.ok) return first;
      if (first.value) return ok(undefined);
      if (!(await refreshed(refresh))) return stale();
      const second = await trySave(userId, item);
      if (!second.ok) return second;
      return second.value ? ok(undefined) : stale();
    },
    async unsave(userId, key) {
      const first = await remove(userId, key);
      if (!first.ok) return first;
      if (first.value >= 1) return ok(undefined);
      // 0 rows: "already gone" and "a session that can't see the row" look the same, and a
      // re-select can't tell them apart either (it sees nothing in both). Only a fresh session can.
      if (!(await refreshed(refresh))) return stale();
      const second = await remove(userId, key);
      if (!second.ok) return second;
      if (second.value >= 1) return ok(undefined);
      const still = await isSaved(userId, key);
      if (!still.ok) return still;
      return still.value ? stale() : ok(undefined);
    },
  };
}

async function refreshLive(): Promise<boolean> {
  const { data } = await supabase.auth.refreshSession();
  return data.session !== null;
}

const live: SavedClient = {
  from: (table) => ({
    select: (columns) => supabase.from(table).select<string, unknown>(columns),
    upsert: (values, opts) => ({
      select: (c) => supabase.from(table).upsert(values, opts).select(c),
    }),
    delete: () => ({
      match: (query) => ({ select: (c) => supabase.from(table).delete().match(query).select(c) }),
    }),
  }),
};
export const savedDb: SavedDb = createSavedDb(live, refreshLive);
