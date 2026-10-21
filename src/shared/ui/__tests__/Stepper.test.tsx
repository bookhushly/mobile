import { fireEvent, render, screen } from '@testing-library/react-native';

import { Stepper } from '@/shared/ui/Stepper';

it('plus calls onChange with value + 1', async () => {
  const onChange = jest.fn();
  await render(<Stepper label="Rooms" value={2} min={1} max={5} onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Increase Rooms' }));
  expect(onChange).toHaveBeenCalledWith(3);
});

it('disables each button at its limit', async () => {
  const onChange = jest.fn();
  await render(<Stepper label="Rooms" value={1} min={1} max={5} onChange={onChange} />);
  const minus = screen.getByRole('button', { name: 'Decrease Rooms' });
  expect(minus.props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(minus);
  expect(onChange).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Increase Rooms' }).props.accessibilityState,
  ).toMatchObject({ disabled: false });
});

it('plus is disabled at max', async () => {
  await render(<Stepper label="Rooms" value={5} min={1} max={5} onChange={jest.fn()} />);
  expect(
    screen.getByRole('button', { name: 'Increase Rooms' }).props.accessibilityState,
  ).toMatchObject({ disabled: true });
});

it('is adjustable, labelled with its value, and handles increment/decrement actions', async () => {
  const onChange = jest.fn();
  await render(<Stepper label="Rooms" value={2} min={1} max={5} onChange={onChange} testID="s" />);
  const node = screen.getByLabelText('Rooms, 2');
  expect(node.props.accessibilityRole).toBe('adjustable');
  await fireEvent(node, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  await fireEvent(node, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(onChange).toHaveBeenNthCalledWith(1, 3);
  expect(onChange).toHaveBeenNthCalledWith(2, 1);
});

it('announces the count as accessibility text', async () => {
  await render(<Stepper label="Rooms" value={2} min={1} max={5} onChange={jest.fn()} />);
  expect(screen.getByLabelText('Rooms, 2').props.accessibilityValue).toMatchObject({ text: '2' });
});

it('ignores increment at max and decrement at min', async () => {
  const onChange = jest.fn();
  await render(<Stepper label="A" value={5} min={5} max={5} onChange={onChange} />);
  const node = screen.getByLabelText('A, 5');
  await fireEvent(node, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  await fireEvent(node, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(onChange).not.toHaveBeenCalled();
});
