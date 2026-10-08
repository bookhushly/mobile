import { fireEvent, render, screen } from '@testing-library/react-native';

import { DensityProvider } from '@/shared/ui/DensityProvider';
import { Input } from '@/shared/ui/Input';
import { PinField } from '@/shared/ui/PinField';
import { SearchField } from '@/shared/ui/SearchField';

it('links the error to the field for screen readers', async () => {
  await render(<Input label="Approver" value="" onChangeText={jest.fn()} error="Enter a name" />);
  expect(screen.getByLabelText('Approver').props.accessibilityHint).toBe('Enter a name');
  expect(screen.getByText('Enter a name')).toBeTruthy();
});

it('shows a hint when there is no error', async () => {
  await render(
    <Input label="Reason" value="" onChangeText={jest.fn()} hint="3 to 200 characters" />,
  );
  expect(screen.getByText('3 to 200 characters')).toBeTruthy();
  expect(screen.getByLabelText('Reason').props.accessibilityHint).toBe('3 to 200 characters');
});

it('prefers the error over the hint', async () => {
  await render(
    <Input label="Reason" value="" onChangeText={jest.fn()} hint="Optional" error="Too short" />,
  );
  expect(screen.getByLabelText('Reason').props.accessibilityHint).toBe('Too short');
  expect(screen.queryByText('Optional')).toBeNull();
});

it('is 64 tall under gate density', async () => {
  await render(
    <DensityProvider density="gate">
      <Input label="Approver" value="" onChangeText={jest.fn()} />
    </DensityProvider>,
  );
  expect(screen.getByLabelText('Approver')).toHaveStyle({ minHeight: 64 });
});

it('is 48 tall by default', async () => {
  await render(<Input label="Approver" value="" onChangeText={jest.fn()} />);
  expect(screen.getByLabelText('Approver')).toHaveStyle({ minHeight: 48 });
});

it('search field clears with one tap', async () => {
  const onChangeText = jest.fn();
  await render(<SearchField label="Search guests" value="ade" onChangeText={onChangeText} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(onChangeText).toHaveBeenCalledWith('');
  expect(screen.getByLabelText('Search guests').props.returnKeyType).toBe('search');
});

it('search field hides the clear button when empty', async () => {
  await render(<SearchField label="Search guests" value="" onChangeText={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
});

it('pin field keeps one secure numeric input and masks digits', async () => {
  const onChangeText = jest.fn();
  await render(<PinField label="PIN" value="12" onChangeText={onChangeText} />);
  const input = screen.getByLabelText('PIN');
  expect(input.props.secureTextEntry).toBe(true);
  expect(input.props.keyboardType).toBe('number-pad');
  expect(input.props.maxLength).toBe(6);
  expect(input.props.autoComplete).toBe('off');
  expect(input.props.textContentType).toBe('none');
  // The boxes are hidden from assistive tech on purpose (the single input is the a11y field).
  expect(screen.getAllByText('•', { includeHiddenElements: true })).toHaveLength(2);
  await fireEvent.changeText(input, '123');
  expect(onChangeText).toHaveBeenCalledWith('123');
});

it('pin field strips non-digits and caps at length', async () => {
  const onChangeText = jest.fn();
  await render(<PinField label="PIN" value="" onChangeText={onChangeText} length={4} />);
  const input = screen.getByLabelText('PIN');
  expect(input.props.maxLength).toBe(4);
  await fireEvent.changeText(input, '1a2b3c4d5');
  expect(onChangeText).toHaveBeenCalledWith('1234');
});

it('pin field links its error to the input', async () => {
  await render(<PinField label="PIN" value="" onChangeText={jest.fn()} error="Wrong PIN" />);
  expect(screen.getByLabelText('PIN').props.accessibilityHint).toBe('Wrong PIN');
  expect(screen.getByText('Wrong PIN')).toBeTruthy();
});
