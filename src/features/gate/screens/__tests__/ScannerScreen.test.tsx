import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScannerScreen } from '@/features/gate/screens/ScannerScreen';
import { useScanView } from '@/features/gate/state/scanView';

jest.mock('@/features/gate/ui/ScannerCamera', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ScannerCamera: ({ onCode }: { onCode: (raw: string) => void }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="fake-camera"
        onPress={() => {
          onCode('3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f');
        }}
      >
        <Text>camera</Text>
      </Pressable>
    ),
  };
});
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

const session = { scan: jest.fn(), tryAgain: jest.fn(), dismiss: jest.fn() };
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
};

beforeEach(() => {
  jest.clearAllMocks();
  useScanView.setState({ view: { current: null, waiting: 0, pending: 0 } });
});

it('shows the door counter and passes camera reads to the session', async () => {
  await render(<ScannerScreen {...base} />);
  expect(screen.getByText('41 / 120')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
  expect(session.scan).toHaveBeenCalledWith('3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f', 'camera');
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
  useScanView.setState({
    view: {
      current: {
        id: 1,
        code: null,
        outcome: { kind: 'couldntCheck', cause: 'network' },
        extraAdmitted: 0,
      },
      waiting: 0,
      pending: 0,
    },
  });
  await render(<ScannerScreen {...base} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(session.tryAgain).toHaveBeenCalledWith(1);
});

it('has no undo control anywhere', async () => {
  await render(<ScannerScreen {...base} />);
  expect(screen.queryByText(/undo|un-admit/i)).toBeNull();
});
