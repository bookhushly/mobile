import type { ScanResponse } from '@/features/gate/domain/outcome';
import type { TicketCode } from '@/features/gate/domain/parseTicketCode';
import { admitBody, summaryBody, type ScanSummary } from '@/features/gate/schemas/scan';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export const SCAN_TIMEOUT_MS = 8_000;

type Requester = Pick<ApiClient, 'request'>;

// Not idempotent on the server: never pass `idempotent: true`. The scan queue owns retries.
export function submitScan(
  client: Requester,
  eventId: string,
  code: TicketCode,
): Promise<ScanResponse> {
  return client.request(`/api/events/${encodeURIComponent(eventId)}/scan`, {
    method: 'POST',
    body: { ticket_id: code },
    schema: admitBody,
    timeoutMs: SCAN_TIMEOUT_MS,
  });
}

export function fetchSummary(
  client: Requester,
  eventId: string,
): Promise<Result<ScanSummary, ApiError>> {
  return client.request(`/api/events/${encodeURIComponent(eventId)}/scan/summary`, {
    schema: summaryBody,
  });
}
