import type { PhotoKey } from '@/features/vendor/domain/today';

// The same Unsplash option photos customers see when they ask (assets/images/*/SOURCES.md): what
// was asked for, never the vendor's own vehicle. Security has no photo (a shield block instead).
export const SERVICE_PHOTO: Record<Exclude<PhotoKey, 'security'>, number> = {
  truck: require('../../../../assets/images/logistics/truck.webp') as number,
  van: require('../../../../assets/images/logistics/van.webp') as number,
  moving: require('../../../../assets/images/logistics/moving.webp') as number,
  courier: require('../../../../assets/images/logistics/courier.webp') as number,
  delivery: require('../../../../assets/images/logistics/delivery.webp') as number,
  motorcycle: require('../../../../assets/images/logistics/motorcycle.webp') as number,
  sedan: require('../../../../assets/images/cars/sedan.webp') as number,
  suv: require('../../../../assets/images/cars/suv.webp') as number,
  bus: require('../../../../assets/images/cars/bus.webp') as number,
  withDriver: require('../../../../assets/images/cars/with-driver.webp') as number,
};
