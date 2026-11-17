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

it('is 68 tall under gate density (64 inside a 2 pt border)', async () => {
  atTextScale(1);
  await render(
    <DensityProvider density="gate">
      <Input label="Approver" value="" onChangeText={jest.fn()} />
    </DensityProvider>,
  );
  expect(screen.getByLabelText('Approver')).toHaveStyle({ minHeight: 64 });
});

const mockDims = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));
const atTextScale = (fontScale: number) => {
  mockDims.fontScale = fontScale;
};

afterEach(() => {
  mockDims.fontScale = 1;
});

it('grows with Dynamic Type so the title never sits on the value (design review)', async () => {
  atTextScale(1.6);
  await render(<Input label="Approver" value="" onChangeText={jest.fn()} />);
  // 8 + 22×1.6 − 4 above the text, 28×1.6 for it, 4 below: taller than the 60 default.
  expect(screen.getByLabelText('Approver')).toHaveStyle({
    minHeight: 8 + 22 * 1.6 - 4 + 28 * 1.6 + 4,
  });
});

it('is 64 tall by default: room for the title inside the box', async () => {
  atTextScale(1);
  await render(<Input label="Approver" value="" onChangeText={jest.fn()} />);
  expect(screen.getByLabelText('Approver')).toHaveStyle({ minHeight: 60 });
});

it('keeps the box the same size when focus thickens the border, so the form never jumps', async () => {
  await render(<Input label="Email" value="" onChangeText={jest.fn()} />);
  // The text area's margin gives back exactly what the thicker border takes.
  const area = () => screen.getByTestId('input-area');
  expect(area()).toHaveStyle({ marginVertical: 1 });
  await fireEvent(screen.getByLabelText('Email'), 'focus');
  expect(area()).toHaveStyle({ marginVertical: 0 });
});

it('rests the title in the box as the placeholder, and shows a real one only once it moves up', async () => {
  await render(
    <Input label="Email" value="" onChangeText={jest.fn()} placeholder="you@example.com" />,
  );
  const field = screen.getByLabelText('Email');
  expect(field.props.placeholder).toBeUndefined();
  await fireEvent(field, 'focus');
  expect(screen.getByLabelText('Email').props.placeholder).toBe('you@example.com');
});

it('keeps the visible title out of the screen reader; the field carries the label', async () => {
  await render(<Input label="Email" value="" onChangeText={jest.fn()} />);
  expect(screen.queryByText('Email')).toBeNull();
  expect(screen.getByText('Email', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByLabelText('Email')).toBeTruthy();
});

it('a search box shows no title, just its placeholder', async () => {
  await render(<SearchField label="Search guests" value="" onChangeText={jest.fn()} />);
  expect(screen.queryByText('Search guests', { includeHiddenElements: true })).toBeNull();
  expect(screen.getByLabelText('Search guests').props.placeholder).toBe('Search guests');
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
