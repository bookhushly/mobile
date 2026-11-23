import { View } from 'react-native';

import {
  pendingQuotes,
  timeline,
  type Stage,
} from '@/features/customer/domain/carRental/carStatus';
import { tripDays, type AskAgainChange } from '@/features/customer/domain/carRental/carRequest';
import type { CarRequest } from '@/features/customer/schemas/carRental';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { RequestTimeline } from '@/features/customer/ui/car/RequestTimeline';
import { stateName } from '@/features/customer/ui/car/WhereStep';
import { TRIP, VEHICLE, carName, dateRange, daysWords } from '@/features/customer/ui/car/carWords';
import { formatNaira } from '@/shared/lib/formatNaira';
import { lagosWhen12, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Stack, Text } from '@/shared/ui';

type Props = {
  request: CarRequest;
  stage: Stage;
  today: IsoDate;
  /** Server-clock now, for whether the deadline has passed. */
  nowMs: number;
  change: AskAgainChange | null;
  onChange: (c: AskAgainChange | null) => void;
};

/** "Mon 30 Nov, 2:00 pm" or "today, 2:00 pm". */
export function untilWords(iso: string, today: IsoDate): string {
  const w = lagosWhen12(iso, today);
  return w.startsWith('at ') ? `today, ${w.slice(3)}` : w.replace(/^on /, '').replace(' at ', ', ');
}

// Design 2A: one screen that always answers "where are we, and what happens next?".
export function StatusView({ request: r, stage, today, nowMs, change, onChange }: Props) {
  const days = tripDays({ pickupDate: r.pickupDate, returnDate: r.returnDate });
  const when = dateRange(r.pickupDate, r.returnDate);
  const what = [
    when,
    r.vehicleType === null ? 'any car' : VEHICLE[r.vehicleType].label.toLowerCase(),
    TRIP[r.tripType].short,
  ].join(' · ');
  const quotes = pendingQuotes(r.offers);
  const low = quotes[0]?.amount ?? null;
  const high = quotes[quotes.length - 1]?.amount ?? null;
  const until = untilWords(r.expiresAt, today);
  const closed = Date.parse(r.expiresAt) <= nowMs;
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
        low === null ? null : `From ${formatNaira(low)} for the ${daysWords(days)}.`,
        closed ? 'No more quotes will come; choose from these.' : `More may come until ${until}.`,
      ]
        .filter((x): x is string => x !== null)
        .join(' ');
      break;
    case 'noQuotes':
      eyebrow = 'Closed · no quotes';
      title = 'No company quoted this time';
      lead = `No company in ${state} quoted ${what} before the deadline. Nothing was charged.`;
      break;
    case 'chosen':
      eyebrow = 'Quote chosen';
      title = 'Pay to book your car';
      lead = `You chose ${r.selectedVendor?.name ?? 'a company'}’s ${carName(r.selectedOffer?.vehicle ?? null, r.vehicleType)}. Pay to book it; your money is held until you confirm the trip’s done.`;
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
      lead = `Sent to car rental companies in ${state}. Quotes show here, and under the bell, as they come in.`;
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
          <Text variant="bodyStrong">Ask again, with a change? Your answers are kept.</Text>
          <ChoiceChips
            label="What to change"
            value={change}
            options={[
              ...(r.vehicleType === null ? [] : [{ value: 'anyCar' as const, label: 'Any car' }]),
              { value: 'otherDates' as const, label: 'Other dates' },
              {
                value: 'otherTrip' as const,
                label: r.tripType === 'chauffeur' ? TRIP.self_drive.label : TRIP.chauffeur.label,
              },
            ]}
            onChange={onChange}
            testID="car-ask-again-change"
          />
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
                  : stage === 'waiting'
                    ? `Open until ${until}`
                    : null,
              mark: marks[1],
            },
            {
              title: 'You pick one and pay',
              line: 'Held safely until the trip’s done',
              mark: marks[2],
            },
            { title: 'Your car arrives', line: null, mark: marks[3] },
          ]}
        />
      )}
    </Stack>
  );
}
