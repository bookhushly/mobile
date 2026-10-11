import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { deskDb } from '@/features/receptionist/api/deskDb';
import type { StaffHotelRow } from '@/features/receptionist/schemas/desk';
import type { ApiError } from '@/shared/lib/errors';
import { plainKv } from '@/shared/platform/storage';

export type DeskHotel = { id: string; name: string; place: string /* 'Ikeja, Lagos' or '' */ };

export type HotelState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'none' }
  | { status: 'unavailable' }
  | { status: 'pick'; hotels: DeskHotel[]; choose: (id: string) => void }
  | { status: 'ready'; hotel: DeskHotel; hotels: DeskHotel[]; change: () => void };

export const deskStaffKey = (userId: string) => ['desk', 'staff', userId] as const;

// The remembered choice holds only a hotel id, never guest data.
const storageKey = (userId: string) => `bh.desk.hotel.${userId}`;

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
class StaffLoadError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`staff hotels load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

type Rows = { total: number; hotels: DeskHotel[] };

function toRows(rows: StaffHotelRow[]): Rows {
  const hotels: DeskHotel[] = [];
  for (const r of rows) {
    // R7: a hidden hotel row (vendor suspended) joins as null and is not offered.
    if (r.hotels === null) continue;
    const place = [r.hotels.city, r.hotels.state].filter((p) => p !== null && p !== '').join(', ');
    hotels.push({ id: r.hotels.id, name: r.hotels.name, place });
  }
  return { total: rows.length, hotels };
}

type Stored = { userId: string; id: string | null };

// R7: 0 rows → none; only hidden hotels → unavailable; 1 usable → ready; several → a picker,
// remembered per user (a stale remembered id is ignored).
export function useHotel(userId: string): HotelState {
  const q = useQuery({
    queryKey: deskStaffKey(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const r = await deskDb.staffHotels(userId);
      if (!r.ok) throw new StaffLoadError(r.error);
      return toRows(r.value);
    },
  });
  const [stored, setStored] = useState<Stored | null>(null);
  useEffect(() => {
    let live = true;
    void plainKv
      .get(storageKey(userId))
      .catch(() => null)
      .then((id) => {
        if (live) setStored({ userId, id });
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const { refetch } = q;
  if (q.isError) return { status: 'error', retry: () => void refetch() };
  if (q.data === undefined || stored === null || stored.userId !== userId)
    return { status: 'loading' };
  const { total, hotels } = q.data;
  if (total === 0) return { status: 'none' };
  if (hotels.length === 0) return { status: 'unavailable' };

  const change = () => {
    setStored({ userId, id: null });
    void plainKv.delete(storageKey(userId)).catch(() => undefined);
  };
  const first = hotels[0];
  if (hotels.length === 1 && first !== undefined)
    return { status: 'ready', hotel: first, hotels, change };
  const chosen = hotels.find((h) => h.id === stored.id);
  if (chosen !== undefined) return { status: 'ready', hotel: chosen, hotels, change };
  return {
    status: 'pick',
    hotels,
    choose: (id) => {
      setStored({ userId, id });
      void plainKv.set(storageKey(userId), id).catch(() => undefined);
    },
  };
}
