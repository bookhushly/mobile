import type { StepMark } from '@/features/customer/domain/carRental/carStatus';

type Track = {
  pickedUpAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  /** The company said the job's done (may come without `deliveredAt`). */
  vendorCompletedAt: string | null;
  /** The customer confirmed (status completed). */
  confirmed: boolean;
};

export type TrackPhase = 'paid' | 'pickedUp' | 'onTheWay' | 'delivered' | 'confirmed';

/** How far a paid delivery has got, from the times the company marked. */
export function trackPhase(t: Track): TrackPhase {
  if (t.confirmed) return 'confirmed';
  if (t.deliveredAt !== null || t.vendorCompletedAt !== null) return 'delivered';
  if (t.inTransitAt !== null) return 'onTheWay';
  if (t.pickedUpAt !== null) return 'pickedUp';
  return 'paid';
}

/** Paid · Picked up · On the way · Delivered: the latest step reached is "now", earlier ones done. */
export function trackMarks(p: TrackPhase): [StepMark, StepMark, StepMark, StepMark] {
  switch (p) {
    case 'paid':
      return ['current', 'later', 'later', 'later'];
    case 'pickedUp':
      return ['done', 'current', 'later', 'later'];
    case 'onTheWay':
      return ['done', 'done', 'current', 'later'];
    case 'delivered':
      return ['done', 'done', 'done', 'current'];
    case 'confirmed':
      return ['done', 'done', 'done', 'done'];
  }
}
