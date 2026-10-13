import { ticketCodeBody, type TicketCodeBody } from '@/features/customer/schemas/ticketCode';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export const TICKET_CODE_TIMEOUT_MS = 8_000;

type Requester = Pick<ApiClient, 'request'>;

// GET (Bearer, holder only). The client's default GET retries are fine here: reading a code is
// idempotent, so `idempotent` is never set.
export function fetchTicketCode(
  c: Requester,
  ticketId: string,
): Promise<Result<TicketCodeBody, ApiError>> {
  return c.request(`/api/tickets/${encodeURIComponent(ticketId)}/code`, {
    schema: ticketCodeBody,
    timeoutMs: TICKET_CODE_TIMEOUT_MS,
  });
}
