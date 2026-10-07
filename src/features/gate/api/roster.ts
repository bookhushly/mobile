import { rosterPage, type RosterPage } from '@/features/gate/schemas/roster';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

// A 2,000-row page is a few hundred KB; give slow venue Wi-Fi room.
export const ROSTER_TIMEOUT_MS = 30_000;

export function fetchRosterPage(
  client: Pick<ApiClient, 'request'>,
  eventId: string,
  p: { cursor: string | null; since: string | null; limit: number },
): Promise<Result<RosterPage, ApiError>> {
  const q = [`limit=${String(p.limit)}`];
  if (p.cursor !== null) q.push(`cursor=${encodeURIComponent(p.cursor)}`);
  if (p.since !== null) q.push(`since=${encodeURIComponent(p.since)}`);
  return client.request(`/api/events/${encodeURIComponent(eventId)}/scan/roster?${q.join('&')}`, {
    schema: rosterPage,
    timeoutMs: ROSTER_TIMEOUT_MS,
  });
}
