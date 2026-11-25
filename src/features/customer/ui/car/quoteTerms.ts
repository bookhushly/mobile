import { CarFront, ShieldCheck, Truck, type LucideIcon } from 'lucide-react-native';

import { tripDays } from '@/features/customer/domain/carRental/carRequest';
import type { LogisticsBody } from '@/features/customer/domain/logistics/logisticsRequest';
import type { SubmitBody } from '@/features/customer/domain/carRental/carRequest';
import type { SecurityBody } from '@/features/customer/domain/security/securityRequest';
import {
  CAR_KIND,
  LOGISTICS_KIND,
  SECURITY_KIND,
  type RfqKind,
  type RfqRow,
} from '@/features/customer/hooks/rfqKinds';
import type { CarOffer, CarRequest } from '@/features/customer/schemas/carRental';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import type { SecurityRequest } from '@/features/customer/schemas/security';
import { SECURITY_SERVICE, teamWords } from '@/features/customer/ui/security/securityWords';
import { carName, dateRange, daysWords } from '@/features/customer/ui/car/carWords';
import { shortDate } from '@/shared/lib/lagosDay';
import { LOGISTICS_VEHICLE } from '@/features/customer/ui/logistics/logisticsWords';

/** How one service talks about its quotes (car rental, logistics, security). */
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
  /** The facts line under the headline; default: company · seats · verified. */
  factsOf?: (o: CarOffer, r: R) => string;
  /** No photo: leave the block out (security teams rarely send photos). */
  photoOptional?: boolean;
  /** "Car rental requests", in "… are kept on your account". */
  requestsWord: string;
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
  requestsWord: 'Car rental requests',
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
  requestsWord: 'Delivery requests',
};

export const SECURITY_TERMS: QuoteTerms<SecurityRequest, SecurityBody> = {
  kind: SECURITY_KIND,
  // Security quotes carry no vehicle: the company is the choice, so it is the headline; the
  // service and team go under it.
  nameOf: (o) => o.vendor?.name ?? 'Security company',
  factsOf: (_o, r) => `${SECURITY_SERVICE[r.service].label} · ${teamWords(r)}`,
  photoOptional: true,
  requestsWord: 'Security requests',
  spanOf: () => null,
  companyWord: 'Security company',
  whenOf: (r) => dateRange(r.pickupDate, r.endDate),
  vehicleWord: 'team',
  showSeats: false,
  doneWords: 'the job’s done',
  icon: ShieldCheck,
};
