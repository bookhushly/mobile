import { ShieldCheck } from 'lucide-react-native';

import { needsYou, stageWords, type Stage } from '@/features/customer/domain/carRental/carStatus';
import type { SecurityRequest } from '@/features/customer/schemas/security';
import { RequestRow } from '@/features/customer/ui/car/CarRequestRow';
import { stateName } from '@/features/customer/ui/car/StateSheet';
import { dateRange } from '@/features/customer/ui/car/carWords';
import { SECURITY_PHOTO } from '@/features/customer/ui/security/securityPhotos';
import { SECURITY_SERVICE } from '@/features/customer/ui/security/securityWords';

type Props = { request: SecurityRequest; stage: Stage; onPress: (id: string) => void };

/** What Bookings says about a security request once it's paid. */
export function securityRowStatus(r: SecurityRequest, stage: Stage): string {
  if (stage === 'booked') return 'Booked';
  if (stage === 'onTrip') return r.vendorCompletedAt === null ? 'On duty' : 'Done · confirm it';
  if (stage === 'done') return 'Done';
  return stageWords(stage, r.offerCount);
}

/** A security request in Bookings: "Security · Home or estate, Lagos". */
export function SecurityRequestRow({ request: r, stage, onPress }: Props) {
  return (
    <RequestRow
      id={r.id}
      title={`Security · ${SECURITY_SERVICE[r.service].label}, ${stateName(r.pickupState)}`}
      when={dateRange(r.pickupDate, r.endDate)}
      status={securityRowStatus(r, stage)}
      urgent={needsYou(stage, r.vendorCompletedAt)}
      photo={SECURITY_PHOTO[r.service]}
      icon={ShieldCheck}
      onPress={onPress}
    />
  );
}
