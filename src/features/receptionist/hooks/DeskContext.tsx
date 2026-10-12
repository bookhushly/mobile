import { createContext, useContext, type ReactNode } from 'react';

import type { DeskHotel } from '@/features/receptionist/hooks/useHotel';
import type { IsoDate } from '@/shared/lib/lagosDay';

// What every desk screen needs: who, where, which Lagos day (R4), the two layout-owned sheets,
// and the app's sign-out (for a 401 after refresh; features can't import auth).
export type Desk = {
  userId: string;
  email: string;
  hotel: DeskHotel;
  today: IsoDate;
  openAccount: () => void;
  openCheckIn: (code?: string) => void;
  signOut: () => void;
};

const DeskContext = createContext<Desk | null>(null);

export function DeskProvider({ value, children }: { value: Desk; children: ReactNode }) {
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk(): Desk {
  const desk = useContext(DeskContext);
  if (desk === null) throw new Error('useDesk must be used inside DeskProvider');
  return desk;
}
