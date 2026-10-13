import {
  bookingIdParam,
  bookingRefParams,
  pagerIndexParam,
} from '@/features/customer/domain/routeParams';

const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';

it('accepts the three kinds with a UUID', () => {
  expect(bookingRefParams('event', ID)).toEqual({ kind: 'event', id: ID });
  expect(bookingRefParams('hotel', ID)).toEqual({ kind: 'hotel', id: ID });
  expect(bookingRefParams('apartment', ID)).toEqual({ kind: 'apartment', id: ID });
});

it.each<[unknown, unknown]>([
  ['events', ID],
  ['Event', ID],
  [undefined, ID],
  [['event'], ID],
  ['event', 'e1'],
  ['event', ''],
  ['event', "1' or '1'='1"],
  ['event', [ID]],
  ['event', undefined],
])('rejects kind %p with id %p', (kind, id) => {
  expect(bookingRefParams(kind, id)).toBeNull();
});

it('reads a booking id param', () => {
  expect(bookingIdParam(ID)).toBe(ID);
  expect(bookingIdParam('h1')).toBeNull();
  expect(bookingIdParam(undefined)).toBeNull();
});

it('takes a pager index within the tickets, else the first', () => {
  expect(pagerIndexParam('0', 3)).toBe(0);
  expect(pagerIndexParam('2', 3)).toBe(2);
  expect(pagerIndexParam(undefined, 3)).toBe(0);
  expect(pagerIndexParam('3', 3)).toBe(0);
  expect(pagerIndexParam('-1', 3)).toBe(0);
  expect(pagerIndexParam('1.5', 3)).toBe(0);
  expect(pagerIndexParam('1e1', 3)).toBe(0);
  expect(pagerIndexParam(' 1', 3)).toBe(0);
  expect(pagerIndexParam(['1'], 3)).toBe(0);
  expect(pagerIndexParam('1', 0)).toBe(0);
});
