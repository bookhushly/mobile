import { tripDays, type AskAgainChange } from '@/features/customer/domain/carRental/carRequest';
import type { Stage } from '@/features/customer/domain/carRental/carStatus';
import type { CarRequest } from '@/features/customer/schemas/carRental';
import { ChoiceChips } from '@/features/customer/ui/car/ChoiceChips';
import { RfqStatusView } from '@/features/customer/ui/car/RfqStatusView';
import { TRIP, VEHICLE, carName, dateRange, daysWords } from '@/features/customer/ui/car/carWords';
import type { IsoDate } from '@/shared/lib/lagosDay';

export { untilWords } from '@/features/customer/ui/car/RfqStatusView';

type Props = {
  request: CarRequest;
  stage: Stage;
  today: IsoDate;
  /** Server-clock now, for whether the deadline has passed. */
  nowMs: number;
  change: AskAgainChange | null;
  onChange: (c: AskAgainChange | null) => void;
};

/** Car rental's words in the shared status screen, with its "Ask again" changes. */
export function StatusView({ request: r, stage, today, nowMs, change, onChange }: Props) {
  const days = tripDays({ pickupDate: r.pickupDate, returnDate: r.returnDate });
  const what = [
    dateRange(r.pickupDate, r.returnDate),
    r.vehicleType === null ? 'any car' : VEHICLE[r.vehicleType].label.toLowerCase(),
    TRIP[r.tripType].short,
  ].join(' · ');
  return (
    <RfqStatusView
      request={r}
      stage={stage}
      today={today}
      nowMs={nowMs}
      copy={{
        companies: 'car rental companies',
        what,
        priceFor: `for the ${daysWords(days)}`,
        chosen: `${r.selectedVendor?.name ?? 'a company'}’s ${carName(r.selectedOffer?.vehicle ?? null, r.vehicleType)}`,
        payTitle: 'Pay to book your car',
        doneWords: 'the trip’s done',
        lastStep: 'Your car arrives',
      }}
      askAgain={
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
      }
    />
  );
}
