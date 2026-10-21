import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cancelBooking } from '@/features/customer/api/bookingActionsApi';
import { createEvent, createStay } from '@/features/customer/api/checkoutApi';
import { checkoutDb } from '@/features/customer/api/checkoutDb';
import {
  eventCreateOutcome,
  stayCreateOutcome,
  type CreateOutcome,
} from '@/features/customer/domain/checkout/createOutcome';
import {
  apartmentBody,
  eventBody,
  hotelBody,
} from '@/features/customer/domain/checkout/createRequest';
import {
  selectionFingerprint,
  ticketLines,
  type EventSelection,
  type StayProblem,
  type StaySelection,
} from '@/features/customer/domain/checkout/selection';
import { checkoutStore, type CheckoutEntry } from '@/features/customer/offline/checkoutStore';
import type { EventCreated, StayCreated } from '@/features/customer/schemas/checkout';
import { api, clock } from '@/shared/api/instance';

// Spec P12, P28. Stays carry an Idempotency-Key kept while the selection is unchanged, so any
// re-send is a safe replay. Events have none: a lost answer is never re-posted, it is settled by
// reading this user's pending booking back (RLS).

export type CreateKind = 'hotel' | 'apartment' | 'event';

export type CreateState = {
  phase: 'idle' | 'sending' | 'unsure' | 'busy' | 'refused' | 'failed';
  words?: string;
  field?: StayProblem;
  waitSeconds?: number;
};

/** What the screen knows that the create answer doesn't: names for the cached entry. */
export type CreateCtx = {
  title: string;
  /** Hotels: the room type booked. */
  roomTypeId?: string;
  /** Events: the free route (no payment) and the date shown on Review. */
  free?: boolean;
  eventDate?: string;
};

/** 409 in_progress is waited out this many times with the same key before a fresh key (P12). */
export const BUSY_RETRIES = 3;
/** The event lookup starts this long before the create was sent (P12; server-clock drift). */
export const EVENT_LOOKBACK_MS = 5000;

const IDLE: CreateState = { phase: 'idle' };
const STILL_WORKING = 'Still working on your last try. Try again in a moment';

type IdemKey = { fingerprint: string; key: string; busyRetries: number };
type Sent = { selection: StaySelection | EventSelection; ctx: CreateCtx };

function isEvent(s: StaySelection | EventSelection): s is EventSelection {
  return 'qty' in s;
}

function stayEntry(
  userId: string,
  listingId: string,
  b: StayCreated['booking'],
  s: StaySelection,
): CheckoutEntry {
  return {
    userId,
    kind: b.type,
    bookingId: b.id,
    listingId,
    title: b.hotel?.name ?? b.apartment?.name ?? '',
    createdAt: b.created_at,
    total: b.total,
    pricing: b.pricing,
    summary: {
      checkIn: b.check_in_date,
      checkOut: b.check_out_date,
      guests: s.adults + s.children,
      ...(b.room_type ? { roomName: b.room_type.name } : {}),
    },
    guestEmail: b.guest_email,
    payment: null,
    paymentEverStarted: false,
  };
}

function eventEntry(
  userId: string,
  listingId: string,
  b: EventCreated['booking'],
  s: EventSelection,
  ctx: CreateCtx,
): CheckoutEntry {
  const tickets = Object.values(ticketLines(s.qty)).reduce((a, n) => a + n, 0);
  return {
    userId,
    kind: 'event',
    bookingId: b.id,
    listingId,
    title: ctx.title,
    createdAt: b.created_at,
    total: b.total_amount,
    pricing: null,
    summary: { tickets, ...(ctx.eventDate !== undefined ? { eventDate: ctx.eventDate } : {}) },
    guestEmail: s.guest.email,
    payment: null,
    paymentEverStarted: false,
  };
}

export function useCreateBooking(
  userId: string,
  kind: CreateKind,
  listingId: string,
): {
  submit: (selection: StaySelection | EventSelection, ctx: CreateCtx) => Promise<void>;
  state: CreateState;
  created: { bookingId: string } | null;
  /** After `unsure`: stays re-send with the same key; events read the booking back. */
  checkAgain: () => Promise<void>;
} {
  const [state, setState] = useState<CreateState>(IDLE);
  const [created, setCreated] = useState<{ bookingId: string } | null>(null);
  const idem = useRef<IdemKey | null>(null);
  const inFlight = useRef(false);
  const last = useRef<Sent | null>(null);
  const eventSentAt = useRef<number | null>(null);
  const live = useRef(true);
  // A call, not a read: TypeScript would keep `live.current` narrowed across an await.
  const alive = useCallback(() => live.current, []);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyWake = useRef<(() => void) | null>(null);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (busyTimer.current !== null) clearTimeout(busyTimer.current);
      busyTimer.current = null;
      // The waiting send wakes, sees it is unmounted, and stops.
      busyWake.current?.();
      busyWake.current = null;
    };
  }, []);

  const show = useCallback((s: CreateState) => {
    if (live.current) setState(s);
  }, []);

  // P28: the entry is on disk before the screen moves on. A failed write never hides the booking.
  const adopt = useCallback(
    async (entry: CheckoutEntry | null, bookingId: string) => {
      if (entry !== null) await checkoutStore.put(entry).catch(() => undefined);
      if (!alive()) return;
      setCreated({ bookingId });
      setState(IDLE);
    },
    [alive],
  );

  /** Shows a server answer that isn't `created`. `busy` here is past its retries, or an event's. */
  const settle = useCallback(
    (o: CreateOutcome): void => {
      switch (o.kind) {
        case 'created':
          return;
        case 'refused':
          // The server answered: a re-send after a fix is a new request, not a cached replay.
          idem.current = null;
          show(
            o.field === undefined
              ? { phase: 'refused', words: o.words }
              : { phase: 'refused', words: o.words, field: o.field },
          );
          return;
        case 'unsure':
          show({ phase: 'unsure' });
          return;
        case 'wait':
        case 'busy':
          // Nothing ran (429), or an event (never re-posted). The next Continue is the user's.
          show({ phase: 'busy', waitSeconds: o.seconds, words: 'Too many tries. Wait a moment' });
          return;
        case 'failed':
          show({ phase: 'failed', words: o.words });
          // The server answered: nothing to replay. A booking it left behind is released (P7).
          idem.current = null;
          if (o.strayBookingId !== null && kind !== 'event') {
            void cancelBooking(api, kind, o.strayBookingId).catch(() => undefined);
          }
          return;
      }
    },
    [kind, show],
  );

  const sleep = useCallback(
    (seconds: number) =>
      new Promise<void>((resolve) => {
        busyWake.current = resolve;
        busyTimer.current = setTimeout(() => {
          busyTimer.current = null;
          busyWake.current = null;
          resolve();
        }, seconds * 1000);
      }),
    [],
  );

  const sendStay = useCallback(
    async (s: StaySelection, ctx: CreateCtx): Promise<void> => {
      if (kind === 'event') return;
      const fingerprint = selectionFingerprint(kind, listingId, ctx.roomTypeId ?? null, s);
      if (idem.current?.fingerprint !== fingerprint) {
        idem.current = { fingerprint, key: Crypto.randomUUID(), busyRetries: 0 };
      }
      const k = idem.current;
      const body =
        kind === 'hotel'
          ? hotelBody(ctx.roomTypeId ?? '', listingId, s)
          : apartmentBody(listingId, s);
      inFlight.current = true;
      show({ phase: 'sending' });
      for (;;) {
        const r = await createStay(api, kind, body, k.key);
        if (r.ok) {
          inFlight.current = false;
          idem.current = null;
          await adopt(stayEntry(userId, listingId, r.value.booking, s), r.value.booking.id);
          return;
        }
        const o = stayCreateOutcome(r.error, kind);
        if (o.kind === 'busy' && k.busyRetries < BUSY_RETRIES) {
          // 409 in_progress: the same key is still being worked on; wait it out (P12).
          k.busyRetries += 1;
          show({ phase: 'busy', waitSeconds: o.seconds });
          await sleep(o.seconds);
          if (!alive()) return;
          continue;
        }
        inFlight.current = false;
        if (o.kind === 'busy') {
          // The earlier try may still land; the next Continue uses a fresh key (P12).
          idem.current = null;
          show({ phase: 'failed', words: STILL_WORKING });
          return;
        }
        settle(o);
        return;
      }
    },
    [kind, listingId, userId, show, adopt, settle, sleep, alive],
  );

  const sendEvent = useCallback(
    async (s: EventSelection, ctx: CreateCtx): Promise<void> => {
      const free = ctx.free === true;
      inFlight.current = true;
      show({ phase: 'sending' });
      eventSentAt.current = clock.serverNow();
      const r = await createEvent(api, eventBody(listingId, s, free), free);
      inFlight.current = false;
      if (r.ok) {
        eventSentAt.current = null;
        // A free registration is never paid for: no entry, so nothing can resume or cancel it.
        await adopt(
          free ? null : eventEntry(userId, listingId, r.value.booking, s, ctx),
          r.value.booking.id,
        );
        return;
      }
      const o = eventCreateOutcome(r.error);
      // Only a lost answer leaves the post unsettled; any server answer settles it.
      if (o.kind !== 'unsure') eventSentAt.current = null;
      // Never re-posted: a busy answer is shown as a wait, and the user decides.
      settle(o);
    },
    [listingId, userId, show, adopt, settle],
  );

  const submit = useCallback(
    async (selection: StaySelection | EventSelection, ctx: CreateCtx): Promise<void> => {
      if (inFlight.current) return;
      // An event whose answer was lost is settled by Check again, never by a second post.
      if (kind === 'event' && eventSentAt.current !== null) return;
      last.current = { selection, ctx };
      if (isEvent(selection)) {
        if (kind === 'event') await sendEvent(selection, ctx);
      } else if (kind !== 'event') {
        await sendStay(selection, ctx);
      }
    },
    [kind, sendEvent, sendStay],
  );

  const checkAgain = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    const sent = last.current;
    if (sent === null) return;
    if (kind !== 'event') {
      // Same selection, same key: a replay at worst.
      if (!isEvent(sent.selection)) await sendStay(sent.selection, sent.ctx);
      return;
    }
    const sentAt = eventSentAt.current;
    if (sentAt === null) return;
    inFlight.current = true;
    show({ phase: 'sending' });
    let found: { id: string; created_at: string } | null;
    try {
      found = await checkoutDb.findRecentEventBooking(
        userId,
        listingId,
        new Date(sentAt - EVENT_LOOKBACK_MS).toISOString(),
      );
    } catch {
      // Couldn't read: still unknown, so Continue stays off.
      inFlight.current = false;
      show({ phase: 'unsure' });
      return;
    }
    inFlight.current = false;
    if (found === null) {
      eventSentAt.current = null;
      show(IDLE);
      return;
    }
    eventSentAt.current = null;
    // The read gives no amounts: no cached breakdown, Review shows the booking's total (P28).
    await adopt(null, found.id);
  }, [kind, listingId, userId, sendStay, show, adopt]);

  return { submit, state, created, checkAgain };
}
