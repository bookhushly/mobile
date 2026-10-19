import { render, screen } from '@testing-library/react-native';

import type { customerDb } from '@/features/customer/api/customerDb';
import { BookingActions } from '@/features/customer/ui/BookingActions';
import type { ActionTarget } from '@/features/customer/ui/actionTarget';

import type { EventBookingRow } from '@/features/customer/schemas/bookings';

import { ev, makeQueryClient, TODAY, USER, wrapper } from '../../hooks/__tests__/customerTestUtils';

// Shared by the BookingActions tests. Each test file declares the module mocks (jest hoists
// them per file); this renders the section with the real hooks over those mocks.

type Db = typeof customerDb;
export type DbMock = {
  event: jest.MockedFunction<Db['event']>;
  hotel: jest.MockedFunction<Db['hotel']>;
  apartment: jest.MockedFunction<Db['apartment']>;
};

export const ME = 'me@example.com';

export async function showActions(target: ActionTarget) {
  const qc = makeQueryClient();
  const onTransferred = jest.fn();
  const r = await render(
    <BookingActions
      userId={USER}
      email={ME}
      target={target}
      today={TODAY}
      onTransferred={onTransferred}
    />,
    { wrapper: wrapper(qc) },
  );
  return { ...r, qc, onTransferred };
}

/** The Manage booking rows, in order. */
export function rowNames(): string[] {
  return screen
    .queryAllByRole('button')
    .map((b) => String(b.props.accessibilityLabel))
    .filter((l) =>
      ['Transfer tickets', 'Ask for a refund', 'Write a review', 'Cancel booking'].includes(l),
    );
}

/** An event three days before TODAY: review only. */
export function pastEvent(): EventBookingRow {
  const base = ev();
  return {
    ...base,
    listing:
      base.listing === null
        ? null
        : { ...base.listing, event_date: '2026-10-10T00:00:00', event_time: null },
  };
}
