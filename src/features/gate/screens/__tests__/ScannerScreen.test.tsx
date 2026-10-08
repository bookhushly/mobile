import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { OverlayView } from '@/features/gate/domain/scanSession';
import { ScannerScreen } from '@/features/gate/screens/ScannerScreen';
import { useScanView } from '@/features/gate/state/scanView';
import { useSyncView } from '@/features/gate/state/syncView';
import { color, density, radius } from '@/shared/theme';

const TICKET = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const mockCamera = { renders: 0, raw: TICKET };

// The real ScannerCamera runs against a fake CameraView (frame de-dupe, pause, memo).
jest.mock('expo-camera', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PermissionStatus: { UNDETERMINED: 'undetermined', GRANTED: 'granted', DENIED: 'denied' },
    useCameraPermissions: () => [null, jest.fn(), jest.fn()],
    CameraView: ({ onBarcodeScanned }: { onBarcodeScanned?: (r: { data: string }) => void }) => {
      mockCamera.renders += 1;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="fake-camera"
          onPress={() => {
            onBarcodeScanned?.({ data: mockCamera.raw });
          }}
        >
          <Text>camera</Text>
        </Pressable>
      );
    },
  };
});
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

const session = { scan: jest.fn(), tryAgain: jest.fn(), dismiss: jest.fn(), show: jest.fn() };
const GUEST = {
  id: 't1',
  ticketType: 'VIP',
  ticketIndex: 2,
  bookingId: 'b1',
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: 'Ada Obi',
  phoneMasked: null,
};
const LOOKUP_ADMITTED = {
  kind: 'admitted' as const,
  ticketType: 'VIP',
  ticketIndex: 2,
  totalTickets: null,
  checkedInCount: null,
  checkedInAt: null,
  via: 'lookup' as const,
};
const OVERRIDE_ADMITTED = {
  kind: 'admitted' as const,
  ticketType: null,
  ticketIndex: null,
  totalTickets: null,
  checkedInCount: null,
  checkedInAt: null,
  via: 'override' as const,
};
const base = {
  title: 'Afro Night',
  summary: { admitted: 41, total: 120, recent: [] },
  summaryStale: false,
  focused: true,
  permission: 'granted' as const,
  canAskPermission: true,
  onRequestPermission: jest.fn(),
  onOpenSettings: jest.fn(),
  muted: false,
  onToggleMute: jest.fn(),
  session,
  onSignIn: jest.fn(),
  onChangeEvent: jest.fn(),
  onLostAssignment: jest.fn(),
  onRefreshList: jest.fn(),
  onSyncNow: jest.fn(),
  loadActivity: jest.fn(() => Promise.resolve([])),
  exportActivity: jest.fn(() => Promise.resolve([])),
  shareCsv: jest.fn(() => Promise.resolve()),
  searchGuests: jest.fn(() => Promise.resolve([GUEST])),
  bookingTickets: jest.fn(() => Promise.resolve([GUEST])),
  needsPinForLookup: jest.fn(() => Promise.resolve(false)),
  checkPin: jest.fn(() => Promise.resolve({ kind: 'ok' as const })),
  admitFromLookup: jest.fn(() => Promise.resolve(LOOKUP_ADMITTED)),
  override: jest.fn(() => Promise.resolve(OVERRIDE_ADMITTED)),
  serverNow: () => Date.parse('2026-10-07T18:00:30Z'),
};

const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>);

const showing = (outcome: OverlayView['outcome']) => {
  useScanView.setState({
    view: { current: { id: 1, code: null, outcome, extraAdmitted: 0 }, waiting: 0, pending: 0 },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCamera.renders = 0;
  mockCamera.raw = TICKET;
  useScanView.setState({ view: { current: null, waiting: 0, pending: 0 } });
});

it('shows the door counter and passes camera reads to the session', async () => {
  await render(<ScannerScreen {...base} />);
  expect(screen.getByText('41 / 120')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
  expect(session.scan).toHaveBeenCalledWith(TICKET, 'camera');
});

it('shows a dash before the first summary', async () => {
  await render(<ScannerScreen {...base} summary={null} />);
  expect(screen.getByText('— / —')).toBeTruthy();
});

it('permission denied: explains, offers settings, and manual entry still works', async () => {
  const onOpenSettings = jest.fn();
  await render(
    <ScannerScreen
      {...base}
      permission="denied"
      canAskPermission={false}
      onOpenSettings={onOpenSettings}
    />,
  );
  expect(screen.queryByRole('button', { name: 'fake-camera' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
  expect(onOpenSettings).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Enter code' })).toBeTruthy();
});

it('unmounts the camera when the screen is not focused', async () => {
  await render(<ScannerScreen {...base} focused={false} />);
  expect(screen.queryByRole('button', { name: 'fake-camera' })).toBeNull();
});

it('renders the current overlay over the camera', async () => {
  showing({ kind: 'couldntCheck', cause: 'network' });
  await render(<ScannerScreen {...base} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(session.tryAgain).toHaveBeenCalledWith(1);
});

it('has no undo control anywhere', async () => {
  await render(<ScannerScreen {...base} />);
  expect(screen.queryByText(/undo|un-admit/i)).toBeNull();
});

it('keeps Change event and the sound toggle at least 48 pt, controls spaced by the gate gap', async () => {
  await render(<ScannerScreen {...base} />);
  expect(flat(screen.getByRole('link', { name: 'Change event' })).minHeight).toBeGreaterThanOrEqual(
    48,
  );
  const sound = flat(screen.getByRole('button', { name: 'Sound on' }));
  expect(sound.minHeight).toBeGreaterThanOrEqual(48);
  expect(sound.minWidth).toBeGreaterThanOrEqual(48);
  expect(flat(screen.getByTestId('scanner-controls')).gap).toBe(density.gate.targetGap);
});

it('Done on a not-assigned refusal leaves; the overlay alone does not', async () => {
  showing({ kind: 'refused', reason: 'notAssigned', fixable: false });
  await render(<ScannerScreen {...base} />);
  expect(base.onLostAssignment).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(session.dismiss).toHaveBeenCalledWith(1);
  expect(base.onLostAssignment).toHaveBeenCalledTimes(1);
});

it('Done on any other refusal stays on the scanner', async () => {
  showing({ kind: 'refused', reason: 'wrongEvent', fixable: false });
  await render(<ScannerScreen {...base} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(session.dismiss).toHaveBeenCalledWith(1);
  expect(base.onLostAssignment).not.toHaveBeenCalled();
});

it('shows "Checking N…" on an ink pill', async () => {
  useScanView.setState({ view: { current: null, waiting: 0, pending: 2 } });
  await render(<ScannerScreen {...base} />);
  expect(screen.getByText('Checking 2…')).toBeTruthy();
  const pill = flat(screen.getByTestId('checking-pill'));
  expect(pill.backgroundColor).toBe(color.textPrimary);
  expect(pill.borderRadius).toBe(radius.r2);
});

it('a summary change does not re-render the camera', async () => {
  const { rerender } = await render(<ScannerScreen {...base} />);
  const before = mockCamera.renders;
  await rerender(
    <ScannerScreen {...base} summary={{ admitted: 42, total: 120, recent: [] }} summaryStale />,
  );
  expect(screen.getByText('42 / 120')).toBeTruthy();
  expect(mockCamera.renders).toBe(before);
});

it('drops the same frame repeated within 500 ms before it reaches the session', async () => {
  await render(<ScannerScreen {...base} />);
  const cam = screen.getByRole('button', { name: 'fake-camera' });
  await fireEvent.press(cam);
  await fireEvent.press(cam);
  expect(session.scan).toHaveBeenCalledTimes(1);
  mockCamera.raw = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  await fireEvent.press(cam);
  expect(session.scan).toHaveBeenCalledTimes(2);
});

it('pauses camera reads while Enter code or Recent is open', async () => {
  await render(<ScannerScreen {...base} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Enter code' }));
  await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
  expect(session.scan).not.toHaveBeenCalled();
});

it('pauses camera reads while Find guest is open', async () => {
  await render(<ScannerScreen {...base} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Find guest' }));
  await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
  expect(session.scan).not.toHaveBeenCalled();
});

it('a lookup admission shows through the session and closes Find guest', async () => {
  useSyncView.setState({
    status: { ...useSyncView.getState().status, list: { count: 1, syncedAt: 1 } },
  });
  await render(<ScannerScreen {...base} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Find guest' }));
  await fireEvent.changeText(screen.getByLabelText('Search guests'), 'Ada');
  await fireEvent.press(await screen.findByRole('button', { name: /Ada Obi/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Admit/ }));
  await waitFor(() => {
    expect(session.show).toHaveBeenCalledWith(LOOKUP_ADMITTED);
  });
  expect(base.admitFromLookup).toHaveBeenCalledWith('t1', null);
  await waitFor(() => {
    expect(screen.queryByPlaceholderText('Name or last phone digits')).toBeNull();
  });
  await act(() => {
    useSyncView.getState().reset();
  });
});

it('marks the counter not updated when the summary failed before any success', async () => {
  await render(<ScannerScreen {...base} summary={null} summaryStale />);
  expect(screen.getByText('— / —')).toBeTruthy();
  expect(screen.getByText('not updated')).toBeTruthy();
});

it('the overlay words times against the server clock, not the phone clock', async () => {
  const phone = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T21:00:00Z'));
  showing({
    kind: 'used',
    checkedInAt: '2026-10-07T18:00:00Z',
    scannedBy: { kind: 'anotherScanner' },
    ticketType: null,
    replayed: false,
  });
  await render(<ScannerScreen {...base} />);
  expect(screen.getByText(/just now/)).toBeTruthy();
  phone.mockRestore();
});

describe('supervisor override', () => {
  const CODE = 'BH2.override-code' as NonNullable<OverlayView['code']>;
  const notInList = () => {
    useScanView.setState({
      view: {
        current: {
          id: 9,
          code: CODE,
          outcome: { kind: 'refused', reason: 'notInList', fixable: false },
          extraAdmitted: 0,
        },
        waiting: 0,
        pending: 0,
      },
    });
    useSyncView.setState({
      status: { ...useSyncView.getState().status, override: { kind: 'open', triesLeft: 5 } },
    });
  };
  const approve = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Supervisor override' }));
    await fireEvent.changeText(await screen.findByLabelText('PIN'), '123456');
    await fireEvent.changeText(screen.getByLabelText('Approver'), 'Bisi');
    await fireEvent.changeText(screen.getByLabelText('Reason'), 'lost ticket');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
  };
  afterEach(async () => {
    await act(() => {
      useSyncView.getState().reset();
    });
  });

  it('approving in the PIN sheet overrides the overlay code, then shows the admission', async () => {
    notInList();
    await render(<ScannerScreen {...base} />);
    await approve();
    await waitFor(() => {
      expect(session.show).toHaveBeenCalledWith(OVERRIDE_ADMITTED);
    });
    expect(base.checkPin).toHaveBeenCalledWith('123456');
    expect(base.override).toHaveBeenCalledTimes(1);
    expect(base.override).toHaveBeenCalledWith(CODE, { approvedBy: 'Bisi', reason: 'lost ticket' });
    expect(session.dismiss).toHaveBeenCalledWith(9);
    expect(session.dismiss.mock.invocationCallOrder[0]).toBeLessThan(
      session.show.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('pauses camera reads while the PIN sheet is open', async () => {
    notInList();
    await render(<ScannerScreen {...base} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Supervisor override' }));
    await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
    expect(session.scan).not.toHaveBeenCalled();
  });

  it('a failed override says so, never admits, and can be tried again', async () => {
    notInList();
    base.override.mockImplementationOnce(() => Promise.reject(new Error('approval required')));
    await render(<ScannerScreen {...base} />);
    await approve();
    expect(await screen.findByText('Couldn’t override — try again')).toBeTruthy();
    expect(session.show).not.toHaveBeenCalled();
    expect(session.dismiss).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Supervisor override' })).toBeEnabled();
  });

  it('locks the overlay while the override records: no second override, no Done', async () => {
    notInList();
    let resolve: (o: typeof OVERRIDE_ADMITTED) => void = () => undefined;
    base.override.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await render(<ScannerScreen {...base} />);
    await approve();
    const busy = await screen.findByRole('button', { name: 'Overriding…' });
    await fireEvent.press(busy);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(session.dismiss).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('PIN')).toBeNull();
    await act(() => {
      resolve(OVERRIDE_ADMITTED);
    });
    await waitFor(() => {
      expect(session.show).toHaveBeenCalledTimes(1);
    });
    expect(base.override).toHaveBeenCalledTimes(1);
  });

  it('keeps camera reads paused while the override records', async () => {
    notInList();
    let resolve: (o: typeof OVERRIDE_ADMITTED) => void = () => undefined;
    base.override.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await render(<ScannerScreen {...base} />);
    await approve();
    await screen.findByRole('button', { name: 'Overriding…' });
    await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
    expect(session.scan).not.toHaveBeenCalled();
    await act(() => {
      resolve(OVERRIDE_ADMITTED);
    });
    await waitFor(() => {
      expect(session.show).toHaveBeenCalledTimes(1);
    });
  });

  it('cancelling the PIN sheet leaves the refusal as it was', async () => {
    notInList();
    await render(<ScannerScreen {...base} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Supervisor override' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(base.override).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Supervisor override' })).toBeEnabled();
  });
});
