import { createContext, useContext, type ReactNode } from 'react';

import type { DeskHotel } from '@/features/receptionist/hooks/useHotel';
import type { IsoDate } from '@/shared/lib/lagosDay';

// What every desk screen needs: who, where, which Lagos day (R4), and the two layout-owned sheets.
export type Desk = {
  userId: string;
  email: string;
  hotel: DeskHotel;
  today: IsoDate;
  openAccount: () => void;
  openCheckIn: (code?: string) => void;
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
