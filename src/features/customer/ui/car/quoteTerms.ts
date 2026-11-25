import { CarFront, Truck, type LucideIcon } from 'lucide-react-native';

import { tripDays } from '@/features/customer/domain/carRental/carRequest';
import type { LogisticsBody } from '@/features/customer/domain/logistics/logisticsRequest';
import type { SubmitBody } from '@/features/customer/domain/carRental/carRequest';
import {
  CAR_KIND,
  LOGISTICS_KIND,
  type RfqKind,
  type RfqRow,
} from '@/features/customer/hooks/rfqKinds';
import type { CarOffer, CarRequest } from '@/features/customer/schemas/carRental';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import { carName, dateRange, daysWords } from '@/features/customer/ui/car/carWords';
import { shortDate } from '@/shared/lib/lagosDay';
import { LOGISTICS_VEHICLE } from '@/features/customer/ui/logistics/logisticsWords';

/** How one service talks about its quotes (car rental, logistics). */
export type QuoteTerms<R extends RfqRow, B> = {
  kind: RfqKind<R, B>;
  /** The quote's headline: the company's vehicle, or what was asked for. */
  nameOf: (o: CarOffer, r: R) => string;
  /** Car rental is priced over days ("3 days", per-day shown); logistics isn't. */
  spanOf: (r: R) => { days: number; words: string } | null;
  /** Under the company's name on the full quote. */
  companyWord: string;
  /** The dates the quotes are for: "Fri 5 → Sun 7 Dec", "Thu 4 Dec". */
  whenOf: (r: R) => string;
  /** "car", "vehicle": in "Verified car". */
  vehicleWord: string;
  /** Seats matter for a car, not for a van of boxes. */
  showSeats: boolean;
  /** "the trip’s done", "it’s delivered". */
  doneWords: string;
  /** The icon for a missing photo or an empty list (a car, a truck). */
  icon: LucideIcon;
};

export const CAR_TERMS: QuoteTerms<CarRequest, SubmitBody> = {
  kind: CAR_KIND,
  nameOf: (o, r) => carName(o.vehicle, r.vehicleType),
  spanOf: (r) => {
    const days = tripDays({ pickupDate: r.pickupDate, returnDate: r.returnDate });
    return { days, words: daysWords(days) };
  },
  companyWord: 'Car rental company',
  whenOf: (r) => dateRange(r.pickupDate, r.returnDate),
  vehicleWord: 'car',
  showSeats: true,
  doneWords: 'the trip’s done',
  icon: CarFront,
};

export const LOGISTICS_TERMS: QuoteTerms<LogisticsRequest, LogisticsBody> = {
  kind: LOGISTICS_KIND,
  nameOf: (o, r) => {
    const own = carName(o.vehicle, null);
    if (own !== 'Car') return own;
    return r.vehicleType === null ? 'Vehicle' : LOGISTICS_VEHICLE[r.vehicleType].label;
  },
  spanOf: () => null,
  companyWord: 'Logistics company',
  whenOf: (r) => shortDate(r.pickupDate),
  vehicleWord: 'vehicle',
  showSeats: false,
  doneWords: 'it’s delivered',
  icon: Truck,
};
