import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import type { LookupQuery } from '@/features/gate/domain/lookupQuery';
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import type { PinCheck } from '@/features/gate/offline/offlineGate';
import type { Approval } from '@/features/gate/offline/outboxStore';
import type { GuestRow } from '@/features/gate/offline/rosterStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { FindGuestSheet } from '@/features/gate/ui/FindGuestSheet';
import { density } from '@/shared/theme';
import { DensityProvider } from '@/shared/ui';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

const BOOKING = 'b0000000-0000-4000-8000-000000000001';
const row = (over: Partial<GuestRow>): GuestRow => ({
  id: 't1',
  ticketType: 'VIP',
  ticketIndex: 2,
  bookingId: BOOKING,
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: 'Ada Obi',
  phoneMasked: '0803••••210',
  ...over,
});

const ADA = row({});
const TOLU = row({
  id: 't2',
  ticketIndex: 1,
  holderName: 'Tolu',
  checkedInAt: '2026-10-07T18:00:00Z',
});
const PENDING = row({ id: 't3', ticketIndex: 3, holderName: null, bookingStatus: 'pending' });

const admitted: ScanOutcome = {
  kind: 'admitted',
  ticketType: 'VIP',
  ticketIndex: 2,
  totalTickets: null,
  checkedInCount: null,
  checkedInAt: null,
  offline: true,
  via: 'lookup',
};

type Deps = {
  search: jest.Mock<Promise<GuestRow[]>, [LookupQuery]>;
  bookingTickets: jest.Mock<Promise<GuestRow[]>, [string]>;
  needsPin: jest.Mock<Promise<boolean>, []>;
  checkPin: jest.Mock<Promise<PinCheck>, [string]>;
  admit: jest.Mock<Promise<ScanOutcome>, [string, Approval | null]>;
  onAdmitted: jest.Mock<undefined, [ScanOutcome]>;
  onClose: jest.Mock<undefined, []>;
};

const deps = (over: Partial<Deps> = {}): Deps => ({
  search: jest.fn((_q: LookupQuery) => Promise.resolve([ADA])),
  bookingTickets: jest.fn((_b: string) => Promise.resolve([TOLU, ADA, PENDING])),
  needsPin: jest.fn(() => Promise.resolve(false)),
  checkPin: jest.fn((_p: string) => Promise.resolve<PinCheck>({ kind: 'ok' })),
  admit: jest.fn((_id: string, _a: Approval | null) => Promise.resolve(admitted)),
  onAdmitted: jest.fn((_o: ScanOutcome) => undefined),
  onClose: jest.fn(() => undefined),
  ...over,
});

// The sheet lives under the gate route group's DensityProvider (rows 72, targets 48).
const setup = async (d: Deps) => {
  await render(
    <DensityProvider density="gate">
      <FindGuestSheet visible {...d} />
    </DensityProvider>,
  );
};

const type = async (text: string) => {
  await fireEvent.changeText(screen.getByLabelText('Search guests'), text);
  await act(async () => {
    jest.advanceTimersByTime(250);
    await Promise.resolve();
  });
};

const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>);

beforeEach(() => {
  jest.useFakeTimers();
  useSyncView.setState({
    status: { ...useSyncView.getState().status, list: { count: 3, syncedAt: 1 } },
  });
});
afterEach(() => {
  jest.useRealTimers();
  useSyncView.getState().reset();
});

it('searches phone tail digits 250 ms after typing stops', async () => {
  const d = deps();
  await setup(d);
  expect(screen.getByPlaceholderText('Name or last phone digits')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search guests'), '210');
  await act(async () => {
    jest.advanceTimersByTime(249);
    await Promise.resolve();
  });
  expect(d.search).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(1);
    await Promise.resolve();
  });
  expect(d.search).toHaveBeenCalledTimes(1);
  expect(d.search).toHaveBeenCalledWith({ kind: 'phoneTail', value: '210' });
  expect(await screen.findByText('Ada Obi')).toBeTruthy();
  expect(screen.getByText('VIP · ticket 2')).toBeTruthy();
  expect(screen.getByText('Not in')).toBeTruthy();
});

it('hints instead of searching when the input is not a query', async () => {
  const d = deps();
  await setup(d);
  await type('a');
  expect(d.search).not.toHaveBeenCalled();
  expect(screen.getByText('Type a name or 2–4 phone digits')).toBeTruthy();
});

it('says no one matches on an empty result', async () => {
  await setup(deps({ search: jest.fn((_q: LookupQuery) => Promise.resolve<GuestRow[]>([])) }));
  await type('Zed');
  expect(await screen.findByText('No one matches')).toBeTruthy();
});

it('says the search failed when it rejects', async () => {
  await setup(
    deps({ search: jest.fn((_q: LookupQuery) => Promise.reject<GuestRow[]>(new Error('db'))) }),
  );
  await type('Ada');
  expect(await screen.findByText('Couldn’t search the list')).toBeTruthy();
});

it('says there is no offline list before one is downloaded, and does not search', async () => {
  useSyncView.getState().reset();
  const d = deps();
  await setup(d);
  expect(screen.getByText('No offline list on this phone yet')).toBeTruthy();
  await type('Ada');
  expect(d.search).not.toHaveBeenCalled();
});

it('tapping a result shows every ticket on the booking with in / not in', async () => {
  const d = deps();
  await setup(d);
  await type('Ada');
  await fireEvent.press(await screen.findByRole('button', { name: /Ada Obi/ }));
  expect(d.bookingTickets).toHaveBeenCalledWith(BOOKING);
  expect(await screen.findByText('Tolu')).toBeTruthy();
  expect(screen.getByText(/^In · /)).toBeTruthy();
  expect(screen.getByText('Not in')).toBeTruthy();
  expect(screen.getByText('Booking pending')).toBeTruthy();
  // Only the confirmed, not-in ticket can be admitted.
  const admits = screen.getAllByRole('button', { name: /^Admit/ });
  expect(admits).toHaveLength(1);
  expect(flat(admits[0] as never).minHeight).toBeGreaterThanOrEqual(44);
});

it('result rows are at least the gate row height', async () => {
  await setup(deps());
  await type('Ada');
  const r = await screen.findByRole('button', { name: /Ada Obi/ });
  expect(flat(r as never).minHeight).toBeGreaterThanOrEqual(density.gate.rowMin);
});

it('splits results into Not in and In with counts', async () => {
  await setup(
    deps({
      search: jest.fn((_q: LookupQuery) =>
        Promise.resolve([
          row({ id: 'a', checkedInAt: null }),
          row({ id: 'b', holderName: 'Bisi', checkedInAt: '2026-10-08T17:40:00Z' }),
        ]),
      ),
    }),
  );
  await type('ade');
  expect(await screen.findByRole('tab', { name: 'Not in (1)' })).toBeSelected();
  expect(screen.getByRole('tab', { name: 'In (1)' })).not.toBeSelected();
  expect(screen.getByText('Ada Obi')).toBeTruthy();
  expect(screen.queryByText('Bisi')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'In (1)' }));
  expect(screen.getByText('Bisi')).toBeTruthy();
  expect(screen.queryByText('Ada Obi')).toBeNull();
  expect(screen.getByText(/^In · /)).toBeTruthy();
});

it('counts zero when no one is in', async () => {
  await setup(deps());
  await type('Ada');
  await screen.findByText('Ada Obi');
  expect(screen.getByRole('tab', { name: 'Not in (1)' })).toBeSelected();
  expect(screen.getByRole('tab', { name: 'In (0)' })).not.toBeSelected();
});

it('admits without a PIN on an ordinary event', async () => {
  const d = deps();
  await setup(d);
  await type('Ada');
  await fireEvent.press(await screen.findByRole('button', { name: /Ada Obi/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Admit/ }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(d.admit).toHaveBeenCalledWith('t1', null);
  expect(d.onAdmitted).toHaveBeenCalledWith(admitted);
  expect(d.checkPin).not.toHaveBeenCalled();
});

it('on a live-ticket event opens the PIN sheet first and admits with the approval', async () => {
  const d = deps({ needsPin: jest.fn(() => Promise.resolve(true)) });
  await setup(d);
  await type('Ada');
  await fireEvent.press(await screen.findByRole('button', { name: /Ada Obi/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Admit/ }));
  expect(await screen.findByText('Supervisor approval')).toBeTruthy();
  expect(d.admit).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('PIN'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Approver'), 'Bisi');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(d.checkPin).toHaveBeenCalledWith('123456');
  expect(d.admit).toHaveBeenCalledWith('t1', { approvedBy: 'Bisi', reason: null });
  expect(d.onAdmitted).toHaveBeenCalledWith(admitted);
});

it('a failed admit keeps the sheet open with an error and never reports admitted', async () => {
  const d = deps({
    admit: jest.fn((_id: string, _a: Approval | null) =>
      Promise.reject<ScanOutcome>(new Error('store')),
    ),
  });
  await setup(d);
  await type('Ada');
  await fireEvent.press(await screen.findByRole('button', { name: /Ada Obi/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Admit/ }));
  expect(await screen.findByText('Not recorded — try again')).toBeTruthy();
  expect(d.onAdmitted).not.toHaveBeenCalled();
  expect(screen.queryByText('Admitted')).toBeNull();
});

const deferred = <T,>() => {
  let resolve: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const openBooking = async () => {
  await type('Ada');
  await fireEvent.press(await screen.findByRole('button', { name: /Ada Obi/ }));
};

it('cannot be closed while an admission is in flight, and the outcome always reaches the scanner', async () => {
  const pending = deferred<ScanOutcome>();
  const d = deps({ admit: jest.fn((_id: string, _a: Approval | null) => pending.promise) });
  await setup(d);
  await openBooking();
  await fireEvent.press(await screen.findByRole('button', { name: /^Admit/ }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(d.admit).toHaveBeenCalledTimes(1);
  const close = screen.getByRole('button', { name: 'Close' });
  expect(close).toBeDisabled();
  await fireEvent.press(close);
  await fireEvent(screen.getByTestId('find-guest-sheet'), 'requestClose');
  expect(d.onClose).not.toHaveBeenCalled();
  await act(async () => {
    pending.resolve(admitted);
    await Promise.resolve();
  });
  expect(d.onAdmitted).toHaveBeenCalledTimes(1);
  expect(d.onAdmitted).toHaveBeenCalledWith(admitted);
});

it('delivers an admission outcome even if the sheet was hidden meanwhile', async () => {
  const pending = deferred<ScanOutcome>();
  const d = deps({ admit: jest.fn((_id: string, _a: Approval | null) => pending.promise) });
  await setup(d);
  await openBooking();
  await fireEvent.press(await screen.findByRole('button', { name: /^Admit/ }));
  await act(async () => {
    await Promise.resolve();
  });
  await screen.rerender(
    <DensityProvider density="gate">
      <FindGuestSheet {...d} visible={false} />
    </DensityProvider>,
  );
  await act(async () => {
    pending.resolve(admitted);
    await Promise.resolve();
  });
  expect(d.onAdmitted).toHaveBeenCalledTimes(1);
});

it('a PIN-approved admission reaches the scanner even if the sheet was hidden meanwhile', async () => {
  const pending = deferred<ScanOutcome>();
  const d = deps({
    needsPin: jest.fn(() => Promise.resolve(true)),
    admit: jest.fn((_id: string, _a: Approval | null) => pending.promise),
  });
  await setup(d);
  await openBooking();
  await fireEvent.press(await screen.findByRole('button', { name: /^Admit/ }));
  await fireEvent.changeText(await screen.findByLabelText('PIN'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Approver'), 'Bisi');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(d.admit).toHaveBeenCalledTimes(1);
  await screen.rerender(
    <DensityProvider density="gate">
      <FindGuestSheet {...d} visible={false} />
    </DensityProvider>,
  );
  await act(async () => {
    pending.resolve(admitted);
    await Promise.resolve();
  });
  expect(d.onAdmitted).toHaveBeenCalledTimes(1);
});

it('gives each Admit button a label naming the ticket', async () => {
  await setup(deps({ bookingTickets: jest.fn((_b: string) => Promise.resolve([ADA])) }));
  await openBooking();
  expect(await screen.findByRole('button', { name: 'Admit Ada Obi, VIP · ticket 2' })).toBeTruthy();
});

it('a double tap on Admit admits once', async () => {
  const d = deps();
  await setup(d);
  await openBooking();
  const admit = await screen.findByRole('button', { name: /^Admit/ });
  await fireEvent.press(admit);
  await fireEvent.press(admit);
  await act(async () => {
    await Promise.resolve();
  });
  expect(d.needsPin).toHaveBeenCalledTimes(1);
  expect(d.admit).toHaveBeenCalledTimes(1);
  expect(d.onAdmitted).toHaveBeenCalledTimes(1);
});

it('a double tap on a PIN event opens one PIN sheet; cancelling it re-enables Admit', async () => {
  const d = deps({ needsPin: jest.fn(() => Promise.resolve(true)) });
  await setup(d);
  await openBooking();
  const admit = await screen.findByRole('button', { name: /^Admit/ });
  await fireEvent.press(admit);
  await fireEvent.press(admit);
  expect(await screen.findAllByText('Supervisor approval')).toHaveLength(1);
  expect(d.needsPin).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    within(screen.getByTestId('pin-sheet')).getByRole('button', { name: 'Close' }),
  );
  expect(screen.queryByText('Supervisor approval')).toBeNull();
  const again = screen.getByRole('button', { name: /^Admit/ });
  expect(again).toBeEnabled();
  await fireEvent.press(again);
  expect(await screen.findByText('Supervisor approval')).toBeTruthy();
  expect(d.needsPin).toHaveBeenCalledTimes(2);
  expect(d.admit).not.toHaveBeenCalled();
});

it('ignores an older search that resolves after a newer one', async () => {
  const BOLA = row({ id: 't9', holderName: 'Bola' });
  const first = deferred<GuestRow[]>();
  const search = jest.fn((q: LookupQuery) =>
    q.value === 'Ada' ? first.promise : Promise.resolve([BOLA]),
  );
  await setup(deps({ search }));
  await type('Ada');
  await type('Bola');
  expect(await screen.findByText('Bola')).toBeTruthy();
  await act(async () => {
    first.resolve([ADA]);
    await Promise.resolve();
  });
  expect(screen.queryByText('Ada Obi')).toBeNull();
  expect(screen.getByText('Bola')).toBeTruthy();
});
