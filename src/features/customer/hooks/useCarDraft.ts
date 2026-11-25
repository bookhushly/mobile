import { EMPTY_DRAFT, STEPS } from '@/features/customer/domain/carRental/carRequest';
import { makeDraftStore } from '@/features/customer/hooks/draftStore';

/** The car rental request being built (design 1A). */
export const useCarDraft = makeDraftStore(EMPTY_DRAFT, STEPS, 'check');
