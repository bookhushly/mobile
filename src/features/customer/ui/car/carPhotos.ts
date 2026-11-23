import type { TripType, VehicleType } from '@/features/customer/domain/carRental/carRequest';

// Unsplash option photos (assets/images/cars/SOURCES.md): what each choice looks like, never a
// company's real car. A quote shows the company's own photos instead.
export const VEHICLE_PHOTO: Record<VehicleType, number> = {
  sedan: require('../../../../../assets/images/cars/sedan.webp') as number,
  suv: require('../../../../../assets/images/cars/suv.webp') as number,
  minivan: require('../../../../../assets/images/cars/minivan.webp') as number,
  luxury: require('../../../../../assets/images/cars/luxury.webp') as number,
  bus: require('../../../../../assets/images/cars/bus.webp') as number,
  coaster: require('../../../../../assets/images/cars/coaster.webp') as number,
  pickup: require('../../../../../assets/images/cars/pickup.webp') as number,
};

export const TRIP_PHOTO: Record<TripType, number> = {
  chauffeur: require('../../../../../assets/images/cars/with-driver.webp') as number,
  self_drive: require('../../../../../assets/images/cars/self-drive.webp') as number,
};

export const CAR_RENTALS_PHOTO =
  require('../../../../../assets/images/cars/car-rentals.webp') as number;
