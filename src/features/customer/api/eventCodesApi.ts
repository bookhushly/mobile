import { withFallback, type Fallback } from '@/features/customer/api/fallback';
import { TICKET_CODE_TIMEOUT_MS } from '@/features/customer/api/ticketCodeApi';
import { eventCodesBody, type EventCodes } from '@/features/customer/schemas/actions';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;

// GET (Bearer, holder only, `ticket` tier per user). The route's own 404 carries `not_found`; a
// bare 404 is a deploy without the route, so the per-ticket route is used instead (spec E2).
export function fetchEventCodes(
  c: Requester,
  bookingId: string,
  signal?: AbortSignal,
): Promise<Result<EventCodes | Fallback, ApiError>> {
  return withFallback(
    c.request(`/api/bookings/event/${encodeURIComponent(bookingId)}/codes`, {
      schema: eventCodesBody,
      timeoutMs: TICKET_CODE_TIMEOUT_MS,
      ...(signal === undefined ? {} : { signal }),
    }),
    false,
  );
}
