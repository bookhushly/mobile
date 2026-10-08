import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '@/shared/ui/Button';
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

it('sheet keeps its body and sticky footer inside a keyboard-avoiding view', async () => {
  await render(
    <Sheet visible title="PIN" onClose={jest.fn()} scroll footer={<Text>Confirm</Text>}>
      <Text>Body</Text>
    </Sheet>,
  );
  // RNTL 14 exposes host elements only, so the KeyboardAvoidingView is found by its testID.
  const avoiding = within(screen.getByTestId('sheet-keyboard'));
  expect(avoiding.getByText('Body')).toBeTruthy();
  expect(avoiding.getByText('Confirm')).toBeTruthy();
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

const accessibleAncestor = (el: { parent: unknown }) => {
  let node = el.parent as { props: { accessible?: boolean }; parent: unknown } | null;
  while (node !== null) {
    if (node.props.accessible === true) return true;
    node = node.parent as typeof node;
  }
  return false;
};

it('an ungrouped static row keeps its label and leaves a trailing control reachable', async () => {
  const onPress = jest.fn();
  await render(
    <ListRow
      title="Ada Obi"
      subtitle="VIP · ticket 2"
      groupAccessibility={false}
      trailing={<Button label="Admit" onPress={onPress} />}
    />,
  );
  expect(screen.getByLabelText('Ada Obi, VIP · ticket 2')).toBeTruthy();
  const admit = screen.getByRole('button', { name: 'Admit' });
  expect(accessibleAncestor(admit)).toBe(false);
  await fireEvent.press(admit);
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('a grouped static row puts its trailing content inside the group', async () => {
  await render(<ListRow title="Regular" trailing={<Text>In</Text>} />);
  expect(accessibleAncestor(screen.getByText('In'))).toBe(true);
});

it('collapsible section header reports expanded', async () => {
  await render(<SectionHeader label="Earlier" count={2} expanded={false} onToggle={jest.fn()} />);
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
