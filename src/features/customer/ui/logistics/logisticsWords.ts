import type {
  ItemCategory,
  ItemWeight,
  LogisticsVehicle,
  ServiceType,
} from '@/features/customer/domain/logistics/logisticsRequest';

// The logistics flow's words. Services, vehicles, categories and weights are the web form's
// (`components/shared/services/logistics-questionnaire.jsx`), in plainer wording.

export const SERVICE: Record<ServiceType, { label: string; line: string; noun: string }> = {
  delivery: { label: 'Delivery', line: 'Across town or state', noun: 'Delivery' },
  courier: { label: 'Package or documents', line: 'Small items, envelopes', noun: 'Package' },
  moving: { label: 'Moving', line: 'Home or office moves', noun: 'Move' },
  cargo: { label: 'Cargo or freight', line: 'Bulk and heavy loads', noun: 'Cargo' },
};

export const LOGISTICS_VEHICLE: Record<LogisticsVehicle, { label: string; line: string }> = {
  bike: { label: 'Motorcycle', line: 'Documents, small parcels' },
  car: { label: 'Car', line: 'A few boxes, medium items' },
  van: { label: 'Van', line: 'Large items, small moves' },
  truck: { label: 'Truck', line: 'Furniture, house moves' },
  trailer: { label: 'Trailer', line: 'Bulk and freight' },
};

export const CATEGORY: Record<ItemCategory, string> = {
  documents: 'Documents',
  electronics: 'Electronics',
  clothing: 'Clothing',
  food: 'Food',
  furniture: 'Furniture',
  appliances: 'Appliances',
  other: 'Other',
};

export const WEIGHT: Record<ItemWeight, string> = {
  '0-5kg': '0–5 kg',
  '5-20kg': '5–20 kg',
  '20-50kg': '20–50 kg',
  '50-100kg': '50–100 kg',
  '100kg+': '100 kg+',
};

/** "2 items · 5–20 kg · fragile". */
export function itemWords(i: {
  quantity: number;
  itemWeight: ItemWeight | null;
  fragile: boolean;
  perishable: boolean;
}): string {
  return [
    i.quantity === 1 ? '1 item' : `${String(i.quantity)} items`,
    i.itemWeight === null ? null : WEIGHT[i.itemWeight],
    i.fragile ? 'fragile' : null,
    i.perishable ? 'perishable' : null,
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
}

/** "Lagos → Abuja (FCT)", or one state when it stays inside it. */
export function stateRoute(from: string, to: string, name: (s: string) => string): string {
  return from === to ? name(from) : `${name(from)} → ${name(to)}`;
}
