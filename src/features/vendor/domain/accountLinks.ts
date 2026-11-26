import type { ServedKind } from './vendorProfile';

// Account: the settings that stay on the web for now (DECISION-11), each opening its own page of
// the web vendor dashboard (`app/(vendor)/vendor/dashboard/*`).

export type AccountLink = { title: string; detail: string; path: string };

const BANK: AccountLink = {
  title: 'Bank account',
  detail: 'Where your money goes',
  path: '/vendor/dashboard/wallet',
};
const HELP: AccountLink = {
  title: 'Help',
  detail: 'Guides and support',
  path: '/vendor/dashboard/help',
};

export function accountLinks(kind: ServedKind): AccountLink[] {
  switch (kind) {
    case 'carRental':
    case 'logistics':
      return [
        {
          title: 'Vehicles and drivers',
          detail: 'Add and edit your fleet',
          path: '/vendor/dashboard/fleet',
        },
        {
          title: 'Business profile and areas',
          detail: 'The states you serve',
          path: '/vendor/dashboard/profile',
        },
        BANK,
        HELP,
      ];
    case 'security':
      return [
        { title: 'Guards', detail: 'Add and edit your guards', path: '/vendor/dashboard/profile' },
        {
          title: 'Business profile and areas',
          detail: 'The states you serve',
          path: '/vendor/dashboard/profile',
        },
        BANK,
        HELP,
      ];
    case 'hotel':
      return [
        {
          title: 'Hotels and rooms',
          detail: 'Listings, rooms and prices',
          path: '/vendor/dashboard/hotels',
        },
        {
          title: 'Business profile',
          detail: 'Details guests see',
          path: '/vendor/dashboard/profile',
        },
        BANK,
        HELP,
      ];
    case 'apartment':
      return [
        {
          title: 'Apartments',
          detail: 'Listings, prices and rules',
          path: '/vendor/dashboard/serviced-apartments',
        },
        {
          title: 'Business profile',
          detail: 'Details guests see',
          path: '/vendor/dashboard/profile',
        },
        BANK,
        HELP,
      ];
    case 'event':
      return [
        {
          title: 'Events',
          detail: 'Create and edit events and tickets',
          path: '/vendor/dashboard/event-management',
        },
        {
          title: 'Gate staff',
          detail: 'Who can scan tickets at your events',
          path: '/vendor/dashboard/gate-staff',
        },
        {
          title: 'Business profile',
          detail: 'Details guests see',
          path: '/vendor/dashboard/profile',
        },
        BANK,
        HELP,
      ];
  }
}
