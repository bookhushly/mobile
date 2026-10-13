import { z } from 'zod';

import {
  APARTMENT_BOOKING_COLUMNS,
  apartmentBookingRow,
  EVENT_BOOKING_COLUMNS,
  eventBookingRow,
  HOTEL_BOOKING_COLUMNS,
  hotelBookingRow,
  type ApartmentBookingRow,
  type EventBookingRow,
  type HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import {
  NOTIFICATION_COLUMNS,
  notificationRow,
  type NotificationRow,
} from '@/features/customer/schemas/notifications';
import { PROFILE_COLUMNS, profileRow, type ProfileRow } from '@/features/customer/schemas/profile';
import { dbErrorToApiError } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';
import { wrap } from '@/shared/supabase/wrap';

type DbRow = {
  data: unknown;
  error: { code?: string } | null;
  status: number;
  /** Only with `{ count: 'exact' }`. */
  count?: number | null;
};
type CountOnly = { count: 'exact'; head: true };

// The slices of the supabase-js builders the customer screens use; tests pass a fake.
export type CustomerQuery = PromiseLike<DbRow> & {
  eq(column: string, value: string | boolean): CustomerQuery;
  order(column: string, opts?: { ascending: boolean }): CustomerQuery;
  limit(count: number): CustomerQuery;
  maybeSingle(): PromiseLike<DbRow>;
};
// Writes always end with `.select('id')`: RLS turns a stale session into "0 rows", not an error.
export type CustomerWrite = {
  eq(column: string, value: string | boolean): CustomerWrite;
  in(column: string, values: readonly string[]): CustomerWrite;
  select(columns: 'id'): PromiseLike<DbRow>;
};
export type SupabaseLike = {
  from(table: string): {
    select(columns: string, opts?: CountOnly): CustomerQuery;
    update(values: Record<string, unknown>): CustomerWrite;
    delete(): CustomerWrite;
  };
};

export type ProfileInput = {
  name: string;
  phone: string | null;
  state: string | null;
  address: string | null;
};

export type CustomerDb = {
  events(userId: string): Promise<Result<EventBookingRow[], ApiError>>;
  hotels(userId: string): Promise<Result<HotelBookingRow[], ApiError>>;
  apartments(userId: string): Promise<Result<ApartmentBookingRow[], ApiError>>;
  event(userId: string, id: string): Promise<Result<EventBookingRow | null, ApiError>>;
  hotel(userId: string, id: string): Promise<Result<HotelBookingRow | null, ApiError>>;
  apartment(userId: string, id: string): Promise<Result<ApartmentBookingRow | null, ApiError>>;
  notifications(userId: string): Promise<Result<NotificationRow[], ApiError>>;
  unreadCount(userId: string): Promise<Result<number, ApiError>>;
  markRead(userId: string, ids: readonly string[]): Promise<Result<number, ApiError>>;
  markAllRead(userId: string): Promise<Result<number, ApiError>>;
  markUnread(userId: string, ids: readonly string[]): Promise<Result<number, ApiError>>;
  remove(userId: string, id: string): Promise<Result<number, ApiError>>;
  profile(userId: string): Promise<Result<ProfileRow | null, ApiError>>;
  saveProfile(userId: string, p: ProfileInput): Promise<Result<number, ApiError>>;
};

const BOOKINGS_LIMIT = 50;
const NOTIFICATIONS_LIMIT = 60;

const eventRows = z.array(eventBookingRow);
const hotelRows = z.array(hotelBookingRow);
const apartmentRows = z.array(apartmentBookingRow);
const notificationRows = z.array(notificationRow);
const maybeEvent = eventBookingRow.nullable();
const maybeHotel = hotelBookingRow.nullable();
const maybeApartment = apartmentBookingRow.nullable();
const maybeProfile = profileRow.nullable();
const touched = z.array(z.object({ id: z.string() }));

async function read<T>(q: PromiseLike<DbRow>, schema: z.ZodType<T>): Promise<Result<T, ApiError>> {
  const r = await wrap(q);
  if (r.error) return err(dbErrorToApiError(r.error));
  const p = schema.safeParse(r.data);
  return p.success ? ok(p.data) : err({ kind: 'validation' });
}

// A head request: no rows, just the count the server computed.
async function count(q: PromiseLike<DbRow>): Promise<Result<number, ApiError>> {
  const r = await q;
  if (r.error) return err(dbErrorToApiError({ code: r.error.code, status: r.status }));
  return typeof r.count === 'number' ? ok(r.count) : err({ kind: 'validation' });
}

async function write(w: CustomerWrite): Promise<Result<number, ApiError>> {
  const r = await read(w.select('id'), touched);
  return r.ok ? ok(r.value.length) : r;
}

// RLS reads and writes scoped to the signed-in user (C1). Explicit columns only; ids go through
// `.eq`/`.in`, never interpolated into filter strings.
export function createCustomerDb(client: SupabaseLike): CustomerDb {
  const newest = (q: CustomerQuery, n: number) =>
    q.order('created_at', { ascending: false }).limit(n);
  const events = (userId: string) =>
    client.from('event_bookings').select(EVENT_BOOKING_COLUMNS).eq('customer_id', userId);
  const hotels = (userId: string) =>
    client.from('hotel_bookings').select(HOTEL_BOOKING_COLUMNS).eq('customer_id', userId);
  const apartments = (userId: string) =>
    client.from('apartment_bookings').select(APARTMENT_BOOKING_COLUMNS).eq('user_id', userId);
  const setRead = (userId: string, ids: readonly string[], value: boolean) =>
    ids.length === 0
      ? Promise.resolve(ok(0))
      : write(
          client.from('notifications').update({ read: value }).eq('user_id', userId).in('id', ids),
        );

  return {
    events: (userId) => read(newest(events(userId), BOOKINGS_LIMIT), eventRows),
    hotels: (userId) => read(newest(hotels(userId), BOOKINGS_LIMIT), hotelRows),
    apartments: (userId) => read(newest(apartments(userId), BOOKINGS_LIMIT), apartmentRows),
    event: (userId, id) => read(events(userId).eq('id', id).maybeSingle(), maybeEvent),
    hotel: (userId, id) => read(hotels(userId).eq('id', id).maybeSingle(), maybeHotel),
    apartment: (userId, id) => read(apartments(userId).eq('id', id).maybeSingle(), maybeApartment),
    notifications: (userId) =>
      read(
        newest(
          client.from('notifications').select(NOTIFICATION_COLUMNS).eq('user_id', userId),
          NOTIFICATIONS_LIMIT,
        ),
        notificationRows,
      ),
    // The bell (C13): a count, not the 60 rows.
    unreadCount: (userId) =>
      count(
        client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false),
      ),
    markRead: (userId, ids) => setRead(userId, ids, true),
    markUnread: (userId, ids) => setRead(userId, ids, false),
    markAllRead: (userId) =>
      write(
        client.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false),
      ),
    remove: (userId, id) =>
      write(client.from('notifications').delete().eq('id', id).eq('user_id', userId)),
    // Never `users.*` (legacy `password` column).
    profile: (userId) =>
      read(
        client.from('users').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
        maybeProfile,
      ),
    // Built key by key: nothing else (above all `role`, C14) can reach the update.
    saveProfile: (userId, p) =>
      write(
        client
          .from('users')
          .update({
            name: p.name,
            phone: p.phone,
            state: p.state,
            address: p.address,
            // No updated_at: a trigger on users sets it.
          })
          .eq('id', userId),
      ),
  };
}

export type StaleSession = { kind: 'staleSession' };

// C13 zero-row guard: RLS answers a write from a stale session with 0 rows, not an error.
// Refresh the session and retry once; still 0 → staleSession (the hook rolls back).
export async function withSessionRetry(
  write: () => Promise<Result<number, ApiError>>,
  expected: number,
  refresh: () => Promise<boolean>,
): Promise<Result<number, ApiError | StaleSession>> {
  const first = await write();
  if (!first.ok || expected <= 0 || first.value >= 1) return first;
  let refreshed = false;
  try {
    refreshed = await refresh();
  } catch {
    // A refresh that throws (offline, revoked) is the same answer as one that fails.
  }
  if (!refreshed) return err({ kind: 'staleSession' });
  const second = await write();
  if (!second.ok || second.value >= 1) return second;
  return err({ kind: 'staleSession' });
}

// Pinning the select result type to `unknown` stops supabase-js parsing the column string at the
// type level (TS2589, excessively deep for an untyped client); rows are validated with zod anyway.
const live: SupabaseLike = {
  from: (table) => ({
    select: (columns, opts) => supabase.from(table).select<string, unknown>(columns, opts),
    update: (values) => supabase.from(table).update(values),
    delete: () => supabase.from(table).delete(),
  }),
};
export const customerDb: CustomerDb = createCustomerDb(live);
