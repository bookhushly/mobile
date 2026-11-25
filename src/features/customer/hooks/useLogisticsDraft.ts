import {
  EMPTY_LOGISTICS,
  LOGISTICS_STEPS,
} from '@/features/customer/domain/logistics/logisticsRequest';
import { makeDraftStore } from '@/features/customer/hooks/draftStore';

/** The logistics request being built (design L1). */
export const useLogisticsDraft = makeDraftStore(EMPTY_LOGISTICS, LOGISTICS_STEPS, 'check');
