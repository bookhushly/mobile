import type {
  LogisticsVehicle,
  ServiceType,
} from '@/features/customer/domain/logistics/logisticsRequest';

// Unsplash option photos (assets/images/logistics/SOURCES.md): what each choice looks like, never
// a company's real vehicle. A quote shows the company's own photos instead.
export const SERVICE_PHOTO: Record<ServiceType, number> = {
  delivery: require('../../../../../assets/images/logistics/delivery.webp') as number,
  courier: require('../../../../../assets/images/logistics/courier.webp') as number,
  moving: require('../../../../../assets/images/logistics/moving.webp') as number,
  cargo: require('../../../../../assets/images/logistics/cargo.webp') as number,
};

export const LOGISTICS_VEHICLE_PHOTO: Record<LogisticsVehicle, number> = {
  bike: require('../../../../../assets/images/logistics/motorcycle.webp') as number,
  car: require('../../../../../assets/images/cars/sedan.webp') as number,
  van: require('../../../../../assets/images/logistics/van.webp') as number,
  truck: require('../../../../../assets/images/logistics/truck.webp') as number,
  trailer: require('../../../../../assets/images/logistics/trailer.webp') as number,
};

export const SEND_OR_MOVE_PHOTO =
  require('../../../../../assets/images/logistics/send-or-move.webp') as number;
