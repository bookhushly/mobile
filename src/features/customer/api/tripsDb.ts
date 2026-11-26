import { z } from 'zod';

import { read, type DbRow } from '@/features/customer/api/customerDb';
import {
  TRIP_NAME_MAX,
  TRIP_NOTES_MAX,
  TRIP_SERVICE_TYPES,
  type Trip,
  type TripDraft,
  type TripServiceType,
  type TripStatus,
} from '@/features/customer/domain/trips/trips';
import { dbErrorToApiError } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';
import { wrap } from '@/shared/supabase/wrap';

// `trips` and `trip_services` under RLS (own rows only), as the web's createTrip writes them with
// the user's own client. There are no trip routes on the web, and none are needed.

const TRIP_COLUMNS =
  'id, name, destination, start_date, end_date, status, notes, created_at, trip_services(id, service_type, status)';

const date = z
  .string()
  .nullable()
  .transform((s) => (s === null ? null : s.slice(0, 10)));
const serviceRow = z.object({
  id: z.string(),
  service_type: z.enum(TRIP_SERVICE_TYPES),
  status: z.enum(['planned', 'booked', 'confirmed', 'cancelled']).nullable(),
});
const tripRow = z.object({
  id: z.string(),
  name: z.string(),
  destination: z.string().nullable(),
  start_date: date,
  end_date: date,
  status: z.enum(['planning', 'active', 'completed', 'cancelled']).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  trip_services: z.array(z.unknown()).nullable(),
});

function toTrip(r: z.infer<typeof tripRow>): Trip {
  // A service the app doesn't know (a type added on the web later) is left out, never fatal.
  const services = (r.trip_services ?? []).flatMap((s) => {
    const p = serviceRow.safeParse(s);
    return p.success
      ? [{ id: p.data.id, type: p.data.service_type, status: p.data.status ?? 'planned' }]
      : [];
  });
  const order = (t: TripServiceType) => TRIP_SERVICE_TYPES.indexOf(t);
  return {
    id: r.id,
    name: r.name,
    destination: r.destination,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status ?? 'planning',
    notes: r.notes,
    createdAt: r.created_at,
    services: services.sort((a, b) => order(a.type) - order(b.type)),
  };
}

const tripRows = z.array(z.unknown()).transform((rows) =>
  rows.flatMap((x) => {
    const p = tripRow.safeParse(x);
    return p.success ? [toTrip(p.data)] : [];
  }),
);
const oneTrip = tripRow.nullable();
const ids = z.array(z.object({ id: z.string() }));
const serviceTypes = z.array(z.object({ service_type: z.string() }));
const UNIQUE_VIOLATION = '23505';

export type TripQuery = PromiseLike<DbRow> & {
  eq(column: string, value: string): TripQuery;
  neq(column: string, value: string): TripQuery;
  order(column: string, opts: { ascending: boolean }): TripQuery;
  maybeSingle(): PromiseLike<DbRow>;
};
type Returning = { select(columns: 'id'): PromiseLike<DbRow> };
type Filtered = { eq(column: string, value: string): Filtered } & Returning;
export type TripsClient = {
  from(table: 'trips' | 'trip_services'): {
    select(columns: string): TripQuery;
    insert(values: Record<string, unknown> | Record<string, unknown>[]): Returning;
    update(values: Record<string, unknown>): Filtered;
  };
};

/** RLS answers a write with a stale session as "0 rows": sign in again. */
const zeroRows = (): Result<never, ApiError> => err({ kind: 'auth' });

export function createTripsDb(client: TripsClient) {
  /** Adds the services not on the trip yet (read first: a retry or a double tap adds nothing). */
  async function addMissing(
    tripId: string,
    types: readonly TripServiceType[],
  ): Promise<Result<void, ApiError>> {
    const have = await read(
      client.from('trip_services').select('service_type').eq('trip_id', tripId),
      serviceTypes,
    );
    if (!have.ok) return have;
    const missing = types.filter((t) => !have.value.some((h) => h.service_type === t));
    if (missing.length === 0) return ok(undefined);
    const r = await read(
      client
        .from('trip_services')
        .insert(missing.map((s) => ({ trip_id: tripId, service_type: s, status: 'planned' })))
        .select('id'),
      ids,
    );
    if (!r.ok) return r;
    return r.value.length === 0 ? zeroRows() : ok(undefined);
  }

  return {
    /** Open trips (not archived), newest first: the web's My trips. */
    async list(userId: string): Promise<Result<Trip[], ApiError>> {
      return read(
        client
          .from('trips')
          .select(TRIP_COLUMNS)
          .eq('user_id', userId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
        tripRows,
      );
    },

    async get(userId: string, id: string): Promise<Result<Trip | null, ApiError>> {
      const r = await read(
        client.from('trips').select(TRIP_COLUMNS).eq('user_id', userId).eq('id', id).maybeSingle(),
        oneTrip,
      );
      if (!r.ok) return r;
      return ok(r.value === null ? null : toTrip(r.value));
    },

    /**
     * The trip, then one planned row per service (the web's two writes). `tripId` is minted once
     * per draft, so a retry after a lost answer finds the trip already there (23505) and adds only
     * the services still missing: never a second trip or a doubled service.
     */
    async create(userId: string, tripId: string, d: TripDraft): Promise<Result<string, ApiError>> {
      const notes = d.notes.trim();
      const t = await wrap(
        client
          .from('trips')
          .insert({
            id: tripId,
            user_id: userId,
            name: d.name.trim().slice(0, TRIP_NAME_MAX),
            destination: d.destination,
            start_date: d.startDate,
            end_date: d.endDate,
            notes: notes === '' ? null : notes.slice(0, TRIP_NOTES_MAX),
            services_needed: d.services,
          })
          .select('id'),
      );
      if (t.error !== null && t.error.code !== UNIQUE_VIOLATION)
        return err(dbErrorToApiError(t.error));
      const added = await addMissing(tripId, d.services);
      return added.ok ? ok(tripId) : added;
    },

    /** The web's addTripService: the row (unless it's already there), `services_needed` in step. */
    async addService(trip: Trip, type: TripServiceType): Promise<Result<void, ApiError>> {
      const r = await addMissing(trip.id, [type]);
      if (!r.ok) return r;
      const needed = [...new Set([...trip.services.map((s) => s.type), type])];
      // Only a summary the web reads for its list; the rows are the truth, so a failure is ignored.
      await read(
        client.from('trips').update({ services_needed: needed }).eq('id', trip.id).select('id'),
        ids,
      );
      return ok(undefined);
    },

    /** Mark complete (`completed`) or archive (`cancelled`), as the web does. */
    async setStatus(
      userId: string,
      id: string,
      status: Extract<TripStatus, 'completed' | 'cancelled'>,
    ): Promise<Result<void, ApiError>> {
      const r = await read(
        client.from('trips').update({ status }).eq('id', id).eq('user_id', userId).select('id'),
        ids,
      );
      if (!r.ok) return r;
      return r.value.length === 0 ? zeroRows() : ok(undefined);
    },
  };
}
export type TripsDb = ReturnType<typeof createTripsDb>;

const live: TripsClient = {
  from: (table) => ({
    select: (columns) => supabase.from(table).select<string, unknown>(columns),
    insert: (values) => ({ select: (c) => supabase.from(table).insert(values).select(c) }),
    update: (values) => {
      const wrapUpdate = (b: ReturnType<ReturnType<typeof supabase.from>['update']>): Filtered => ({
        eq: (column, value) => wrapUpdate(b.eq(column, value)),
        select: (c) => b.select(c),
      });
      return wrapUpdate(supabase.from(table).update(values));
    },
  }),
};
export const tripsDb = createTripsDb(live);
