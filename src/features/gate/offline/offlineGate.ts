import { decideOffline, scannedBy, ticketIdOf, type RosterTicket } from '@/features/gate/domain/offlineDecide';
import { afterFailure, afterSuccess, lockState, type LockRecord, type LockState } from '@/features/gate/domain/overrideLock';
import { parseVerifier, verifyPin, type PinVerifier } from '@/features/gate/domain/overridePin';
import type { LookupQuery } from '@/features/gate/domain/lookupQuery';
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import type { TicketCode } from '@/features/gate/domain/parseTicketCode';
import type { ClockState } from '@/shared/lib/clockGuard';

import type { DeviceStore } from './deviceStore';
import type { Approval, OutboxStore } from './outboxStore';
import type { GuestRow, RosterStore } from './rosterStore';

export type OverrideAvailability = { kind: 'none' } | LockState; // 'none' = no usable verifier
export type PinCheck =
  | { kind: 'ok' }
  | { kind: 'wrong'; triesLeft: number }
  | { kind: 'locked'; minutesLeft: number }
  | { kind: 'unavailable' };

// A lock that cannot be read is treated as locked, never as open.
const UNREADABLE_LOCK: Extract<LockState, { kind: 'locked' }> = { kind: 'locked', minutesLeft: 15 };

export type OfflineGateDeps = {
  eventId: string;
  roster: RosterStore;
  outbox: OutboxStore;
  device: DeviceStore;
  serverNow: () => number;
  clockState: () => ClockState;
  appVersion: string;
  onKeysOutdated: () => void;
  onAdmitted: () => void;
  /** Told about storage failures the gate handles itself (an unreadable lock), for diagnostics. */
  report?: (e: unknown) => void;
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
      // An override this phone already approved for an unlisted ticket: a second presentation is
      // "already used", not "not in offline list" (a BH2 code reaches here only with a valid signature).
      if (d.outcome.kind === 'refused' && d.outcome.reason === 'notInList' && id !== null) {
        const mine = await deps.outbox.hasTicket(eventId, id);
        if (mine !== null) return usedOutcome(null, mine.scannedAt);
      }
      if (d.outcome.kind === 'couldntCheck' && d.outcome.cause === 'keysOutdated') {
        try {
          deps.onKeysOutdated();
        } catch {
          // A throwing callback must not replace the outcome.
        }
      }
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
      return usedOutcome(rec.ticket, scannedAt);
    }
    return admittedOutcome(ticket, scannedAt, undefined);
  }

  // After a recorded admission: tell the caller, then add group context. Neither may turn a
  // committed admission into an error.
  async function admittedOutcome(
    ticket: RosterTicket | null,
    scannedAt: string,
    via: 'lookup' | 'override' | undefined,
  ): Promise<ScanOutcome> {
    try {
      deps.onAdmitted();
    } catch {
      // The admission is already committed; a failing callback must not report it as an error.
    }
    let progress: { total: number; checkedIn: number } | null = null;
    try {
      if (ticket !== null) progress = await deps.roster.bookingProgress(eventId, ticket.bookingId);
    } catch {
      progress = null;
    }
    return {
      kind: 'admitted',
      offline: true,
      ...(via === undefined ? {} : { via }),
      ticketType: ticket?.ticketType ?? null,
      ticketIndex: ticket?.ticketIndex ?? null,
      totalTickets: progress?.total ?? null,
      checkedInCount: progress?.checkedIn ?? null,
      checkedInAt: scannedAt,
    };
  }

  const usedOutcome = (t: RosterTicket | null, fallbackAt: string): ScanOutcome => ({
    kind: 'used',
    checkedInAt: t?.checkedInAt ?? fallbackAt,
    scannedBy: t === null ? { kind: 'me' } : scannedBy(t),
    ticketType: t?.ticketType ?? null,
    replayed: false,
  });

  // A PIN check opens one admission for a short while; the gate itself enforces it, not the UI.
  let grant: number | null = null;
  let pinChain: Promise<unknown> = Promise.resolve();
  const GRANT_MS = 60_000;

  // Taken (and cleared) at the start of every admission attempt, so a refusal or an error can never
  // leave a grant behind for another ticket.
  function takeGrant(): number | null {
    const at = grant;
    grant = null;
    return at;
  }

  function requireFreshGrant(at: number | null): void {
    // A negative age means the server clock moved back since the PIN: not trusted.
    const age = at === null ? Number.NaN : deps.serverNow() - at;
    if (!(age >= 0 && age <= GRANT_MS)) throw new Error('approval required');
  }

  const len = (v: string) => v.trim().length;
  function validateApproval(approval: Approval, reasonRequired: boolean): void {
    const by = len(approval.approvedBy);
    const reason = approval.reason === null ? null : len(approval.reason);
    const badReason = reasonRequired
      ? reason === null || reason < 3 || reason > 200
      : reason !== null && reason > 200;
    if (by < 1 || by > 80 || badReason) throw new Error('invalid approval');
  }

  async function admitFromLookup(ticketId: string, approval: Approval | null): Promise<ScanOutcome> {
    const granted = takeGrant();
    if (approval !== null) validateApproval(approval, false);
    const meta = await deps.roster.meta(eventId);
    if (meta === null || !meta.ready) return { kind: 'couldntCheck', cause: 'noOfflineList' };
    // A UI bug must never be able to skip the PIN on a live-ticket event.
    if (meta.requireDynamic && approval === null) throw new Error('approval required');
    const ticket = await deps.roster.ticket(eventId, ticketId);
    if (ticket === null) return { kind: 'refused', reason: 'notInList', fixable: false };
    if (ticket.bookingStatus !== 'confirmed') return { kind: 'refused', reason: 'notConfirmed', fixable: false };
    const nowMs = deps.serverNow();
    const scannedAt = new Date(nowMs).toISOString();
    if (ticket.checkedInAt !== null) return usedOutcome(ticket, scannedAt);
    if (meta.requireDynamic) requireFreshGrant(granted);
    const rec = await deps.outbox.recordAdmission({
      eventId,
      ticketId,
      code: ticketId,
      scannedAt,
      kid: null,
      appVersion: deps.appVersion,
      mode: 'manual_lookup',
      ...(approval === null ? {} : { approval }),
    });
    if (!rec.recorded) return usedOutcome(rec.ticket, scannedAt);
    return admittedOutcome(ticket, scannedAt, 'lookup');
  }

  async function override(code: TicketCode, approval: { approvedBy: string; reason: string }): Promise<ScanOutcome> {
    const granted = takeGrant();
    validateApproval(approval, true);
    const ticketId = ticketIdOf(code);
    if (ticketId === null) return { kind: 'refused', reason: 'invalid', fixable: false };
    // The override is always PIN-gated: it needs a usable verifier, an open lock and a fresh grant.
    if ((await availability()).kind !== 'open') throw new Error('approval required');
    const listed = await deps.roster.ticket(eventId, ticketId);
    if (listed !== null && listed.bookingStatus !== 'confirmed') {
      return { kind: 'refused', reason: 'notConfirmed', fixable: false };
    }
    requireFreshGrant(granted);
    const scannedAt = new Date(deps.serverNow()).toISOString();
    // The store syncs the ticket UUID, not the scanned code: a BH2 code would expire on the server
    // before a late sync, and its signature was already checked before "Not in offline list".
    const rec = await deps.outbox.recordOverride({
      eventId,
      ticketId,
      scannedAt,
      appVersion: deps.appVersion,
      approval,
    });
    // Already recorded by this phone (or the list has since shown it in): never a refusal.
    if (!rec.recorded) return usedOutcome(rec.ticket, scannedAt);
    // Read after the commit so the group count includes this admission.
    let ticket: RosterTicket | null = null;
    try {
      ticket = await deps.roster.ticket(eventId, ticketId);
    } catch {
      ticket = null;
    }
    return admittedOutcome(ticket, scannedAt, 'override');
  }

  async function verifier(): Promise<PinVerifier | null> {
    const meta = await deps.roster.meta(eventId);
    return meta === null ? null : parseVerifier(meta.override);
  }

  const reportLock = (e: unknown): void => {
    try {
      deps.report?.(e);
    } catch {
      // Reporting must never change the answer.
    }
  };

  async function availability(): Promise<OverrideAvailability> {
    try {
      if ((await verifier()) === null) return { kind: 'none' };
    } catch {
      return { kind: 'none' };
    }
    try {
      return lockState(await deps.device.lock(), deps.serverNow());
    } catch (e) {
      reportLock(e);
      return UNREADABLE_LOCK;
    }
  }

  // Count first: the failure is persisted before the PIN is checked, so a kill mid-check still counts.
  async function checkPinNow(pin: string): Promise<PinCheck> {
    grant = null;
    const now = deps.serverNow();
    let rec: LockRecord;
    try {
      rec = await deps.device.lock();
    } catch (e) {
      reportLock(e);
      return UNREADABLE_LOCK;
    }
    const st = lockState(rec, now);
    if (st.kind === 'locked') return st;
    try {
      const v = await verifier();
      if (v === null) return { kind: 'unavailable' };
      const counted = afterFailure(rec, now);
      await deps.device.setLock(counted);
      if (!(await verifyPin(pin, v))) {
        const after = lockState(counted, now);
        return after.kind === 'locked' ? after : { kind: 'wrong', triesLeft: after.triesLeft };
      }
      await deps.device.setLock(afterSuccess());
      grant = deps.serverNow();
      return { kind: 'ok' };
    } catch {
      return { kind: 'unavailable' };
    }
  }

  function checkPin(pin: string): Promise<PinCheck> {
    const run = pinChain.then(() => checkPinNow(pin));
    pinChain = run.catch(() => undefined);
    return run;
  }

  const needsPinForLookup = async (): Promise<boolean> => (await deps.roster.meta(eventId))?.requireDynamic === true;
  const search = (q: LookupQuery): Promise<GuestRow[]> => deps.roster.search(eventId, q);
  const bookingTickets = (bookingId: string): Promise<GuestRow[]> => deps.roster.bookingTickets(eventId, bookingId);

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

  return {
    decide,
    noteLive,
    availability,
    checkPin,
    needsPinForLookup,
    search,
    bookingTickets,
    admitFromLookup,
    override,
  };
}

export type OfflineGate = ReturnType<typeof createOfflineGate>;
