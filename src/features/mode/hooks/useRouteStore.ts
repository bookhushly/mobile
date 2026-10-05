import { create } from 'zustand';

import type { AppRoute } from '@/features/mode/domain/route';

type Store = { route: AppRoute; setRoute: (r: AppRoute) => void };

export const useRouteStore = create<Store>((set) => ({
  route: 'loading',
  setRoute: (route) => {
    set({ route });
  },
}));

export const ROUTE_HREF = {
  update: '/update-required',
  auth: '/sign-in',
  modeError: '/mode-error',
  webOnly: '/web-only',
  gate: '/gate',
  receptionist: '/front-desk',
  customer: '/home',
} as const;
