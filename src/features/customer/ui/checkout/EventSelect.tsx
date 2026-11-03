import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TextInput } from 'react-native';

import {
  eventProblems,
  eventSubtotal,
  isFreeOrder,
  ticketLines,
  withoutContactProblems,
  type EventSelection,
  type Guest,
} from '@/features/customer/domain/checkout/selection';
import { eventStock, lowStockThreshold } from '@/features/customer/domain/discover';
import { useEventQuestions } from '@/features/customer/hooks/useCheckoutData';
import { useCreateBooking } from '@/features/customer/hooks/useCreateBooking';
import { loadFailed } from '@/features/customer/hooks/loadState';
import { promoFor, usePromo } from '@/features/customer/hooks/usePromo';
import { useRecheckPromoOnSignIn } from '@/features/customer/hooks/useRecheckPromoOnSignIn';
import { useSelectTotal } from '@/features/customer/hooks/useSelectTotal';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import type { EventDetail } from '@/features/customer/schemas/listings';
import { EventTickets, ticketLinesOf } from '@/features/customer/ui/checkout/EventTickets';
import { FormLoading } from '@/features/customer/ui/checkout/FormLoading';
import { GuestFields } from '@/features/customer/ui/checkout/GuestFields';
import { PromoRow } from '@/features/customer/ui/checkout/PromoRow';
import { QuestionFields } from '@/features/customer/ui/checkout/QuestionFields';
import { SelectFooter } from '@/features/customer/ui/checkout/SelectFooter';
import { SignedInNote } from '@/features/customer/ui/checkout/SignedInNote';
import {
  eventWords,
  focusFirst,
  guestErrors,
  ticketsWord,
} from '@/features/customer/ui/checkout/selectWords';
import { clock } from '@/shared/api/instance';
import { formatNaira, Screen } from '@/shared/ui';

type Props = {
  event: EventDetail;
  userId: string;
  guest: Guest;
  /** Signed in and the profile has settled: the contact fields can be shown and filled. */
  guestReady: boolean;
  /** Signed in, but the account may yet be staff: Continue stays off until this clears. */
  modePending: boolean;
  header: ReactNode;
  onCreated: (bookingId: string, free: boolean) => void;
  /** Re-reads the listing: after a refusal the stock counts may be stale (P11). */
  onRefused: () => void;
};

const BLOCKED: Partial<Record<ReturnType<typeof eventStock>, string>> = {
  soldOut: 'Sold out',
  started: 'This event has started',
  notOnSale: 'Tickets aren’t on sale right now',
};

// Spec §5 Select (events): a stepper per package (P18), the organiser's questions (P17), promo
// (P9) and contact details (P16). Free orders register straight away (P19). Signed out, Continue
// asks for an account first and the details stay hidden until there is one.
export function EventSelect({
  event: e,
  userId,
  guest,
  guestReady,
  modePending,
  header,
  onCreated,
  onRefused,
}: Props) {
  const [sel, setSel] = useState<EventSelection>({ qty: {}, answers: {}, promo: null, guest });
  const [tried, setTried] = useState(false);
  // Once only: a later profile refetch must not hide the fields or overwrite what was typed. The
  // details are new to the person, so they aren't marked wrong until the next Continue.
  const [guestFilled, setGuestFilled] = useState(guestReady);
  if (guestReady && !guestFilled) {
    setGuestFilled(true);
    setSel((s) => ({ ...s, guest }));
    setTried(false);
  }
  const signedOut = userId === '';
  const showGuest = !signedOut && guestFilled;
  const [startedSignedOut] = useState(signedOut);
  const ask = useSignInPrompt((s) => s.ask);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const answerInputs = useRef<Record<string, TextInput | null>>({});
  const questionsQuery = useEventQuestions(e.id);
  const create = useCreateBooking(userId, 'event', e.id);
  const promo = usePromo('event', e.id);
  // Null when unreadable: never free, and Continue stays off (A7).
  const listingPrice = e.price;
  const subtotal = eventSubtotal(sel.qty, e.ticket_packages, listingPrice);
  const amount = subtotal > 0 ? subtotal : null;
  useRecheckPromoOnSignIn(userId, promo, amount);
  const { promo: sentPromo, stale } = promoFor(promo.state, amount);
  // A free order (and an unreadable price) has no amount, so no charge either. A code covering a
  // paid order can't be booked (P19), so it takes nothing off: the footer never reads ₦0 beside that.
  const discount = sentPromo !== null && amount !== null && sentPromo.discount < amount;
  const { total: payable, note } = useSelectTotal(
    'event',
    amount === null ? null : amount - (discount ? sentPromo.discount : 0),
  );
  const sentFree = useRef(false);
  const handed = useRef(false);
  const created = create.created;
  useEffect(() => {
    if (created === null || handed.current) return;
    handed.current = true;
    onCreated(created.bookingId, sentFree.current);
  }, [created, onCreated]);
  // P11: a 409 (or any refusal) may mean the counts moved; fresh `remaining` caps the steppers.
  // Once per refusal: the callback may change identity on every render.
  const createState = create.state;
  const refetchedFor = useRef<object | null>(null);
  useEffect(() => {
    if (createState.phase !== 'refused' || refetchedFor.current === createState) return;
    refetchedFor.current = createState;
    onRefused();
  }, [createState, onRefused]);

  const questions = questionsQuery.data;
  if (questions === undefined) {
    return (
      <FormLoading
        header={header}
        failed={loadFailed(questionsQuery)}
        title="Couldn’t load this event’s form"
        onRetry={() => {
          void questionsQuery.refetch();
        }}
      />
    );
  }

  const lines = ticketLinesOf(e);
  const threshold = lowStockThreshold(e.low_stock_threshold);
  const blocked = BLOCKED[eventStock(e, clock.serverNow())] ?? null;
  const chosen = ticketLines(sel.qty);
  const total = Object.values(chosen).reduce((a, b) => a + b, 0);
  const selection: EventSelection = { ...sel, promo: sentPromo };
  const free = isFreeOrder(selection, e.ticket_packages, listingPrice);
  const problems = eventProblems(selection, e.ticket_packages, questions, free, listingPrice);
  const shown = tried ? problems : [];
  const missing = new Set(shown.flatMap((p) => (typeof p === 'object' ? [p.question] : [])));
  // An unreadable price or a covering promo is said at once (it blocks Continue); the rest after
  // Continue.
  const ticketProblem = problems.includes('priceUnavailable')
    ? 'priceUnavailable'
    : problems.includes('promoZero')
      ? 'promoZero'
      : shown.find((p) => p === 'noTickets' || p === 'tooMany' || p === 'overStock');
  const refused = create.state.phase === 'refused' ? create.state : null;
  const hasPrices = lines.some((l) => l.price > 0);

  const footer = (
    <SelectFooter
      estimate={
        total === 0
          ? 'Choose tickets'
          : `${ticketsWord(total)} · ${free ? 'Free' : formatNaira(payable ?? subtotal)}`
      }
      blocked={blocked}
      problem={ticketProblem !== undefined ? eventWords(ticketProblem) : null}
      create={create.state}
      refusalShownAtField={refused?.field !== undefined}
      gettingDetails={
        modePending || (!signedOut && (!showGuest || promo.state.phase === 'checking'))
      }
      chargeNote={note}
      disabled={promo.state.phase === 'checking'}
      onContinue={() => {
        setTried(true);
        const stopping = signedOut ? withoutContactProblems(problems) : problems;
        if (stopping.length > 0) {
          focusFirst(
            stopping,
            { name: nameRef, email: emailRef, phone: phoneRef },
            eventWords,
            (p) =>
              typeof p === 'object' ? { current: answerInputs.current[p.question] ?? null } : null,
          );
          return;
        }
        if (signedOut) {
          ask('book');
          return;
        }
        sentFree.current = free;
        void create.submit(selection, {
          title: e.title ?? '',
          free,
          ...(e.event_date !== null ? { eventDate: e.event_date } : {}),
        });
      }}
      onCheckAgain={() => {
        void create.checkAgain();
      }}
    />
  );

  return (
    <Screen scroll header={header} footer={footer}>
      <EventTickets
        lines={lines}
        qty={sel.qty}
        total={total}
        threshold={threshold}
        closed={blocked !== null}
        onQty={(name, n) => {
          setSel((s) => ({ ...s, qty: { ...s.qty, [name]: n } }));
        }}
      />
      <QuestionFields
        questions={questions}
        answers={sel.answers}
        missing={missing}
        onAnswer={(id, text) => {
          setSel({ ...sel, answers: { ...sel.answers, [id]: text } });
        }}
        inputRef={(id, input) => {
          answerInputs.current[id] = input;
        }}
      />
      {hasPrices ? (
        <PromoRow
          state={promo.state}
          stale={stale}
          amount={amount}
          onApply={(code) => {
            if (amount !== null) void promo.apply(code, amount);
          }}
          onRemove={promo.remove}
        />
      ) : null}
      {showGuest && startedSignedOut ? <SignedInNote /> : null}
      {showGuest ? (
        <GuestFields
          guest={sel.guest}
          onChange={(g) => {
            setSel({ ...sel, guest: g });
          }}
          errors={guestErrors(shown)}
          nameRef={nameRef}
          emailRef={emailRef}
          phoneRef={phoneRef}
          showName={free}
        />
      ) : null}
    </Screen>
  );
}
