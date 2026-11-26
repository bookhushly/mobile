import { EMPTY_TRIP, TRIP_STEPS } from '@/features/customer/domain/trips/trips';
import { makeDraftStore } from '@/features/customer/hooks/draftStore';

/** The trip being planned, step by step (in memory; a sign-out forgets it). */
export const useTripDraft = makeDraftStore(EMPTY_TRIP, TRIP_STEPS, 'name');
