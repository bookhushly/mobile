import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  pendingQuotes,
  timeline,
  type Stage,
} from '@/features/customer/domain/carRental/carStatus';
import type { RfqRow } from '@/features/customer/hooks/rfqKinds';
import { RequestTimeline } from '@/features/customer/ui/car/RequestTimeline';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { formatNaira } from '@/shared/lib/formatNaira';
import { lagosWhen12, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Stack, Text } from '@/shared/ui';

/** The service's own words in the shared status screen. */
export type StatusCopy = {
  /** "car rental companies", "logistics companies". */
  companies: string;
  /** What was asked for, one line: "Fri 5 → Sun 7 Dec · sedan · with a driver". */
  what: string;
  /** After the lowest price: "for the 3 days"; null when there's nothing to add. */
  priceFor: string | null;
  /** "Ikeja Car Hire’s Toyota Camry 2019". */
  chosen: string;
  /** "Pay to book your car". */
  payTitle: string;
  /** "the trip’s done", "it’s delivered". */
  doneWords: string;
  /** The timeline's last step: "Your car arrives", "It’s delivered". */
  lastStep: string;
  /** In "No company … quoted {askedFor}"; defaults to `what`. */
  askedFor?: string;
};

type Props = {
  request: RfqRow;
  stage: Stage;
  today: IsoDate;
  /** Server-clock now, for whether the deadline has passed. */
  nowMs: number;
  copy: StatusCopy;
  /** Under "no quotes": what can change when asking again (car rental's chips). */
  askAgain?: ReactNode;
};

/** "Mon 30 Nov, 2:00 pm" or "today, 2:00 pm". */
export function untilWords(iso: string, today: IsoDate): string {
  const w = lagosWhen12(iso, today);
  return w.startsWith('at ') ? `today, ${w.slice(3)}` : w.replace(/^on /, '').replace(' at ', ', ');
}

// Design 2A (car rental and logistics): one screen that always answers "where are we, and what happens next?".
export function RfqStatusView({ request: r, stage, today, nowMs, copy, askAgain }: Props) {
  const what = copy.what;
  const quotes = pendingQuotes(r.offers);
  const low = quotes[0]?.amount ?? null;
  const high = quotes[quotes.length - 1]?.amount ?? null;
  // A logistics row may have no deadline: then quotes stay open.
  const until = r.expiresAt === null ? null : untilWords(r.expiresAt, today);
  const closed = r.expiresAt !== null && Date.parse(r.expiresAt) <= nowMs;
  const state = stateName(r.pickupState);
  const marks = timeline(stage);

  let eyebrow: string;
  let title: string;
  let lead: string;
  switch (stage) {
    case 'quotes':
      eyebrow =
        quotes.length === 1 ? '1 quote to compare' : `${String(quotes.length)} quotes to compare`;
      title = 'Quotes are in';
      lead = [
        low === null
          ? null
          : `From ${formatNaira(low)}${copy.priceFor === null ? '' : ` ${copy.priceFor}`}.`,
        closed
          ? 'No more quotes will come; choose from these.'
          : until === null
            ? 'More may come.'
            : `More may come until ${until}.`,
      ]
        .filter((x): x is string => x !== null)
        .join(' ');
      break;
    case 'noQuotes':
      eyebrow = 'Closed · no quotes';
      title = 'No company quoted this time';
      lead = `No company in ${state} quoted ${copy.askedFor ?? what} before the deadline. Nothing was charged.`;
      break;
    case 'chosen':
      eyebrow = 'Quote chosen';
      title = copy.payTitle;
      lead = `You chose ${copy.chosen}. Pay to book it; your money is held until you confirm ${copy.doneWords}.`;
      break;
    case 'cancelled':
      // A quote had been chosen: it may have been paid, so the words cover the money either way.
      eyebrow = 'Cancelled';
      title =
        r.selectedOffer === null ? 'You cancelled this request' : 'You cancelled this booking';
      lead =
        r.selectedOffer === null
          ? 'Companies can’t quote on it any more. Nothing was charged.'
          : 'If you had paid, a refund of your payment was started when you cancelled.';
      break;
    case 'waiting':
    case 'booked':
    case 'onTrip':
    case 'done':
    case 'problem':
    case 'refunded':
      // Only 'waiting' reaches this view; the paid stages show BookedView.
      eyebrow = 'Waiting for quotes';
      title = 'Your request is out';
      lead = `Sent to ${copy.companies} in ${state}. Quotes show here, and under the bell, as they come in.`;
  }

  return (
    <Stack gap="s7">
      <View style={{ gap: space.s2 }}>
        <Text variant="label" tone="textSecondary" testID="car-stage">
          {eyebrow}
        </Text>
        <Text variant="titleLg" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="body" tone="textSecondary">
          {lead}
        </Text>
      </View>
      {stage === 'noQuotes' ? (
        <View style={{ gap: space.s3 }}>
          <Text variant="bodyStrong">
            {askAgain === undefined
              ? 'Ask again? Your answers are kept.'
              : 'Ask again, with a change? Your answers are kept.'}
          </Text>
          {askAgain}
        </View>
      ) : stage === 'cancelled' ? null : (
        <RequestTimeline
          testID="car-timeline"
          items={[
            { title: 'Request sent', line: what, mark: marks[0] },
            {
              title:
                stage === 'quotes'
                  ? `${String(quotes.length)} ${quotes.length === 1 ? 'quote' : 'quotes'} so far`
                  : 'Quotes arrive',
              line:
                stage === 'quotes' && low !== null && high !== null
                  ? low === high
                    ? formatNaira(low)
                    : `${formatNaira(low)} to ${formatNaira(high)}`
                  : stage === 'waiting' && until !== null
                    ? `Open until ${until}`
                    : null,
              mark: marks[1],
            },
            {
              title: 'You pick one and pay',
              line: `Held safely until ${copy.doneWords}`,
              mark: marks[2],
            },
            { title: copy.lastStep, line: null, mark: marks[3] },
          ]}
        />
      )}
    </Stack>
  );
}
