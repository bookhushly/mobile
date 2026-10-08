import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Divider } from '@/shared/ui/Divider';
import { Header } from '@/shared/ui/Header';
import { ListRow, SectionHeader } from '@/shared/ui/ListRow';
import { Screen } from '@/shared/ui/Screen';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

it('sheet has a header with a working Close and its title', async () => {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Sheet visible title="Activity" onClose={onClose} testID="sheet">
        <Text>Body</Text>
      </Sheet>
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('header', { name: 'Activity' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('sheet close can be disabled while work is in flight', async () => {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Sheet visible title="Find guest" onClose={onClose} closeDisabled>
        <Text>Body</Text>
      </Sheet>
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
});

it('sheet renders without a SafeAreaProvider and shows its footer', async () => {
  await render(
    <Sheet visible title="Enter code" onClose={jest.fn()} footer={<Text>Footer action</Text>}>
      <Text>Body</Text>
    </Sheet>,
  );
  expect(screen.getByText('Footer action')).toBeTruthy();
});

it('segmented control exposes tabs with counts and selection', async () => {
  const onChange = jest.fn();
  await render(
    <SegmentedControl
      value="toSync"
      onChange={onChange}
      testID="segments"
      options={[
        { value: 'toSync', label: 'To sync', count: 3 },
        { value: 'synced', label: 'Synced' },
      ]}
    />,
  );
  expect(screen.getByRole('tab', { name: 'To sync (3)' })).toBeSelected();
  expect(screen.getByRole('tab', { name: 'Synced' })).not.toBeSelected();
  // The container is not `accessible` (that would merge the tabs into one node), so query by testID.
  expect(screen.getByTestId('segments').props.accessibilityRole).toBe('tablist');
  await fireEvent.press(screen.getByRole('tab', { name: 'Synced' }));
  expect(onChange).toHaveBeenCalledWith('synced');
});

it('list row is a button only when pressable', async () => {
  const onPress = jest.fn();
  await render(
    <>
      <ListRow title="VIP · ticket 3" subtitle="14:02" onPress={onPress} />
      <ListRow title="Regular" />
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'VIP · ticket 3, 14:02' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /Regular/ })).toBeNull();
  expect(screen.getByLabelText('Regular')).toBeTruthy();
});

it('collapsible section header reports expanded', async () => {
  await render(
    <SectionHeader label="Earlier" count={2} expanded={false} onToggle={jest.fn()} />,
  );
  expect(screen.getByRole('button', { name: 'Earlier (2)' })).not.toBeExpanded();
});

it('static section header is a header', async () => {
  await render(<SectionHeader label="Today" />);
  expect(screen.getByRole('header', { name: 'Today' })).toBeTruthy();
});

it('header exposes its title as a header with a subtitle', async () => {
  await render(<Header title="Scan" subtitle="Lagos launch" />);
  expect(screen.getByRole('header', { name: 'Scan' })).toBeTruthy();
  expect(screen.getByText('Lagos launch')).toBeTruthy();
});

it('screen renders header, body and a sticky footer', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen header={<Header title="Events" />} footer={<Text>Primary</Text>}>
        <Text>Body</Text>
        <Divider />
      </Screen>
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('header', { name: 'Events' })).toBeTruthy();
  expect(screen.getByText('Body')).toBeTruthy();
  expect(screen.getByText('Primary')).toBeTruthy();
});

it('screen keeps working for existing callers (children + scroll)', async () => {
  await render(
    <Screen scroll>
      <Text>Only body</Text>
    </Screen>,
  );
  expect(screen.getByText('Only body')).toBeTruthy();
});
