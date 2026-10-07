import { batchBody, type BatchBody } from '@/features/gate/schemas/batch';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export type BatchItem = { client_seq: number; ticket_id: string; scanned_at: string; mode: 'offline' };

// Idempotent on the server (device_id + client_seq), so the client may retry it.
export function postBatch(
  client: Pick<ApiClient, 'request'>,
  eventId: string,
  deviceId: string,
  items: BatchItem[],
): Promise<Result<BatchBody, ApiError>> {
  return client.request(`/api/events/${encodeURIComponent(eventId)}/scan/batch`, {
    method: 'POST',
    body: { device_id: deviceId, items },
    schema: batchBody,
    idempotent: true,
    timeoutMs: 30_000,
  });
}
