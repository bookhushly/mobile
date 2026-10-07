import type { ScannerDb } from '@/shared/api/scannableEvents';

import { supabase } from './client';
import { wrap } from './wrap';

export const scannerDb: ScannerDb = {
  assignments: (userId) =>
    wrap(
      supabase
        .from('event_scanners')
        .select('listing_id, listing:listings(id,title,event_date,event_time,location,vendor_id)')
        .eq('user_id', userId)
        .eq('is_active', true),
    ),
  vendorLinks: (userId) =>
    wrap(
      supabase
        .from('vendor_scanners')
        .select('vendor_id')
        .eq('user_id', userId)
        .eq('is_active', true),
    ),
  isListingScanner: (listingId, userId) =>
    wrap(supabase.rpc('is_listing_scanner', { p_listing_id: listingId, p_user_id: userId })),
};
