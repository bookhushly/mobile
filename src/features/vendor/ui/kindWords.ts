import type { ServedKind } from '@/features/vendor/domain/vendorProfile';

/** The kind of business in words, under its name. */
export const KIND_WORD: Record<ServedKind, string> = {
  carRental: 'Car rental',
  logistics: 'Logistics',
  security: 'Security',
  hotel: 'Hotel',
  apartment: 'Serviced apartments',
  event: 'Events',
};
