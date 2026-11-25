import { Truck } from 'lucide-react-native';

import { needsYou, stageWords, type Stage } from '@/features/customer/domain/carRental/carStatus';
import { trackPhase, type TrackPhase } from '@/features/customer/domain/logistics/tracking';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import { RequestRow } from '@/features/customer/ui/car/CarRequestRow';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { SERVICE_PHOTO } from '@/features/customer/ui/logistics/logisticsPhotos';
import { SERVICE, stateRoute } from '@/features/customer/ui/logistics/logisticsWords';
import { shortDate } from '@/shared/lib/lagosDay';

type Props = { request: LogisticsRequest; stage: Stage; onPress: (id: string) => void };

const TRACK_WORDS: Record<TrackPhase, string> = {
  paid: 'Booked',
  pickedUp: 'Picked up',
  onTheWay: 'On the way',
  delivered: 'Delivered · confirm it arrived',
  confirmed: 'Delivered',
};

/** What Bookings says about a logistics request: tracking words once it's paid. */
export function logisticsRowStatus(r: LogisticsRequest, stage: Stage): string {
  if (stage === 'booked' || stage === 'onTrip') {
    return TRACK_WORDS[trackPhase({ ...r, confirmed: false })];
  }
  if (stage === 'done') return TRACK_WORDS.confirmed;
  return stageWords(stage, r.offerCount);
}

/** A logistics request in Bookings: "Delivery · Lagos → Abuja (FCT)". */
export function LogisticsRequestRow({ request: r, stage, onPress }: Props) {
  // Once a quote is chosen, only the company's own photo stands for the vehicle; before that, the
  // service's option photo (what the request is for).
  const chosen = r.selectedOffer;
  const photo =
    chosen === null
      ? SERVICE_PHOTO[r.serviceType]
      : (chosen.vehicle?.imageUrls[0] ?? chosen.imageUrls[0] ?? null);
  return (
    <RequestRow
      id={r.id}
      title={`${SERVICE[r.serviceType].noun} · ${stateRoute(r.pickupState, r.deliveryState, stateName)}`}
      when={shortDate(r.pickupDate)}
      status={logisticsRowStatus(r, stage)}
      urgent={needsYou(stage, r.vendorCompletedAt)}
      photo={photo}
      icon={Truck}
      onPress={onPress}
    />
  );
}
