import { useQuery, useQueryClient } from '@tanstack/react-query';

import { customerDb } from '@/features/customer/api/customerDb';
import type { BookingKind } from '@/features/customer/domain/myBookings';
import { CustomerLoadError, customerKeys } from '@/features/customer/hooks/customerKeys';
import { useSavedWallet } from '@/features/customer/hooks/useSavedWallet';
import type { BookingRows } from '@/features/customer/hooks/useMyBookings';
import type { WalletEntry } from '@/features/customer/offline/wallet';
import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export type BookingRowOf = {
  event: EventBookingRow;
  hotel: HotelBookingRow;
  apartment: ApartmentBookingRow;
};

type Fetchers = {
  [K in BookingKind]: (
    userId: string,
    id: string,
  ) => Promise<Result<BookingRowOf[K] | null, ApiError>>;
};
const fetchers: Fetchers = {
  event: (u, id) => customerDb.event(u, id),
  hotel: (u, id) => customerDb.hotel(u, id),
  apartment: (u, id) => customerDb.apartment(u, id),
};

type Listed = {
  [K in BookingKind]: (rows: BookingRows, id: string) => BookingRowOf[K] | undefined;
};
const listed: Listed = {
  event: (rows, id) => rows.events.find((r) => r.id === id),
  hotel: (rows, id) => rows.hotels.find((r) => r.id === id),
  apartment: (rows, id) => rows.apartments.find((r) => r.id === id),
};

export function useBooking<K extends BookingKind>(
  userId: string,
  kind: K,
  id: string,
): {
  /** undefined while loading (or failed); null when RLS shows no such booking. */
  row: BookingRowOf[K] | null | undefined;
  /** The saved copy, only when the network load failed. */
  fromWallet: WalletEntry | null;
  error: boolean;
  refetch: () => Promise<unknown>;
} {
  const qc = useQueryClient();
  const fetchOne: Fetchers[K] = fetchers[kind];
  const fromList: Listed[K] = listed[kind];
  // Wrapped: TanStack's placeholder typing can't resolve a bare generic row type.
  const q = useQuery({
    queryKey: customerKeys.booking(userId, kind, id),
    queryFn: async (): Promise<{ row: BookingRowOf[K] | null }> => {
      const r = await fetchOne(userId, id);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return { row: r.value };
    },
    // The list row has the same columns: open the details at once while the fresh read runs.
    placeholderData: () => {
      const rows = qc.getQueryData<BookingRows>(customerKeys.bookings(userId));
      const row = rows === undefined ? undefined : fromList(rows, id);
      return row === undefined ? undefined : { row };
    },
  });
  const failed = q.isError && q.data === undefined;
  const { wallet } = useSavedWallet(userId, failed);
  const fromWallet = wallet?.entries.find((e) => e.kind === kind && e.id === id) ?? null;
  return {
    row: q.data?.row,
    fromWallet,
    error: failed && wallet !== undefined && fromWallet === null,
    refetch: q.refetch,
  };
}
