import { createContext, useContext, type ReactNode } from 'react';

import { density, type DensityName } from '@/shared/theme';

const DensityContext = createContext<DensityName>('customer');

// Set once per mode's route group: gate → gate, receptionist → work, customer/auth → customer.
export function DensityProvider({
  density: name,
  children,
}: {
  density: DensityName;
  children: ReactNode;
}) {
  return <DensityContext.Provider value={name}>{children}</DensityContext.Provider>;
}

export function useDensityName(): DensityName {
  return useContext(DensityContext);
}

export function useDensity() {
  return density[useContext(DensityContext)];
}
