import type { ApiError } from '@/shared/lib/errors';
import type { IsoDate } from '@/shared/lib/lagosDay';

// Everything under `all(hotelId)` is what a live event or a completed action invalidates (R10).
export const deskKeys = {
  all: (hotelId: string) => ['desk', hotelId] as const,
  guests: (hotelId: string, today: IsoDate) => ['desk', hotelId, 'guests', today] as const,
  rooms: (hotelId: string) => ['desk', hotelId, 'rooms'] as const,
  booking: (hotelId: string, id: string) => ['desk', hotelId, 'booking', id] as const,
};

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
export class DeskLoadError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`desk load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

// R10: lists poll every 30 s while their screen is focused; off-screen they stop.
export const DESK_POLL_MS = 30_000;
