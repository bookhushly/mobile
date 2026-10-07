import { decideOffline, ticketIdOf } from '@/features/gate/domain/offlineDecide';
import type { ScanOutcome, ScannedBy } from '@/features/gate/domain/outcome';
import type { TicketCode } from '@/features/gate/domain/parseTicketCode';
import type { ClockState } from '@/shared/lib/clockGuard';

import type { OutboxStore } from './outboxStore';
import type { RosterStore } from './rosterStore';

export type OfflineGateDeps = {
  eventId: string;
  roster: RosterStore;
  outbox: OutboxStore;
  serverNow: () => number;
  clockState: () => ClockState;
  appVersion: string;
  onKeysOutdated: () => void;
  onAdmitted: () => void;
};

const byOf = (byMe: boolean | null, name: string | null): ScannedBy => {
  if (byMe !== false) return { kind: 'me' };
  return name === null || name.trim() === '' ? { kind: 'unknown' } : { kind: 'named', name };
};

export function createOfflineGate(deps: OfflineGateDeps) {
  const { eventId } = deps;

  async function decide(code: TicketCode): Promise<ScanOutcome> {
    const meta = await deps.roster.meta(eventId);
    if (meta === null || !meta.ready) return { kind: 'couldntCheck', cause: 'noOfflineList' };
    const id = ticketIdOf(code);
    const ticket = id === null ? null : await deps.roster.ticket(eventId, id);
    const isBookingId =
      id !== null && ticket === null && !code.startsWith('BH') && (await deps.roster.hasBooking(eventId, id));
    const nowMs = deps.serverNow();
    const d = decideOffline(code, {
      ticket,
      isBookingId,
      requireDynamic: meta.requireDynamic,
      keys: meta.keys,
      clockSuspect: deps.clockState().suspect,
      nowMs,
      listUpdatedAt: meta.syncedAt ?? 0,
    });
    if (d.kind === 'outcome') {
      if (d.outcome.kind === 'couldntCheck' && d.outcome.cause === 'keysOutdated') deps.onKeysOutdated();
      return d.outcome;
    }

    const scannedAt = new Date(nowMs).toISOString();
    // Write-ahead: this resolves only after the outbox row has committed.
    const rec = await deps.outbox.recordAdmission({
      eventId,
      ticketId: d.ticketId,
      code,
      scannedAt,
      kid: d.kid,
      appVersion: deps.appVersion,
    });
    if (!rec.recorded) {
      // The same ticket, presented another way, won the race a moment ago.
      const t = rec.ticket;
      return {
        kind: 'used',
        checkedInAt: t?.checkedInAt ?? scannedAt,
        scannedBy: byOf(t?.byMe ?? null, t?.scannedBy ?? null),
        ticketType: t?.ticketType ?? null,
        replayed: false,
      };
    }
    deps.onAdmitted();
    // Group context is a nicety: a failed read must not turn a recorded admission into an error.
    let progress: { total: number; checkedIn: number } | null = null;
    try {
      if (ticket !== null) progress = await deps.roster.bookingProgress(eventId, ticket.bookingId);
    } catch {
      progress = null;
    }
    return {
      kind: 'admitted',
      offline: true,
      ticketType: ticket?.ticketType ?? null,
      ticketIndex: ticket?.ticketIndex ?? null,
      totalTickets: progress?.total ?? null,
      checkedInCount: progress?.checkedIn ?? null,
      checkedInAt: scannedAt,
    };
  }

  // Spec decision 7: what the server says online keeps the offline list true.
  async function noteLive(code: TicketCode, outcome: ScanOutcome): Promise<void> {
    if (outcome.kind !== 'admitted' && outcome.kind !== 'used') return;
    if (outcome.kind === 'admitted' && outcome.offline === true) return;
    const id = ticketIdOf(code);
    if (id === null) return;
    const at = outcome.checkedInAt ?? new Date(deps.serverNow()).toISOString();
    if (outcome.kind === 'admitted') {
      await deps.roster.markCheckedIn(eventId, id, at, true, null);
      return;
    }
    const by = outcome.scannedBy;
    await deps.roster.markCheckedIn(
      eventId,
      id,
      at,
      by.kind === 'me' ? true : by.kind === 'unknown' ? null : false,
      by.kind === 'named' ? by.name : null,
    );
  }

  return { decide, noteLive };
}

export type OfflineGate = ReturnType<typeof createOfflineGate>;
