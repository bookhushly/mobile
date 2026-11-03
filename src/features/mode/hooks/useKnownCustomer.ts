import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';

/**
 * Customer is held while a browsing person's mode loads, and that account may yet be staff.
 * Browsing ends once the mode has settled, so only then is this known to be a customer.
 * `customerId` is '' until then; `modePending` is the window itself: signed in, not yet known.
 */
export function useKnownCustomer(
  signedInId: string | null,
  recovery: boolean,
): { customerId: string; modePending: boolean } {
  const browsing = useBrowseChoice((s) => s.browsing);
  if (signedInId === null) return { customerId: '', modePending: false };
  return {
    customerId: !recovery && browsing !== true ? signedInId : '',
    modePending: browsing === true,
  };
}
