import { fireEvent, render, screen } from '@testing-library/react-native';

import { CodeField } from '@/shared/ui/CodeField';
import { Illustration } from '@/shared/ui/Illustration';
import { PasswordField } from '@/shared/ui/PasswordField';
import { RuleList } from '@/shared/ui/RuleList';

it('password field toggles visibility', async () => {
  await render(<PasswordField label="Password" value="x" onChangeText={jest.fn()} />);
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText('Password').props.autoCapitalize).toBe('none');
  expect(screen.getByLabelText('Password').props.autoCorrect).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
});

it('code field shows digits, autofills one-time codes and strips paste noise', async () => {
  const onChangeText = jest.fn();
  await render(<CodeField label="Code" value="12" onChangeText={onChangeText} />);
  const input = screen.getByLabelText('Code');
  expect(input.props.textContentType).toBe('oneTimeCode');
  expect(input.props.autoComplete).toBe('one-time-code');
  expect(input.props.keyboardType).toBe('number-pad');
  expect(input.props.secureTextEntry).not.toBe(true);
  expect(screen.getAllByText('1', { includeHiddenElements: true })).toHaveLength(1);
  expect(screen.getAllByText('2', { includeHiddenElements: true })).toHaveLength(1);
  await fireEvent.changeText(input, '123 456\n');
  expect(onChangeText).toHaveBeenCalledWith('123456');
  await fireEvent.changeText(input, '12345678');
  expect(onChangeText).toHaveBeenLastCalledWith('123456');
});

it('code field honours a custom length and links its error', async () => {
  const onChangeText = jest.fn();
  await render(
    <CodeField label="Code" value="" onChangeText={onChangeText} length={4} error="Wrong code" />,
  );
  const input = screen.getByLabelText('Code');
  expect(input.props.accessibilityHint).toBe('Wrong code');
  expect(screen.getByText('Wrong code')).toBeTruthy();
  await fireEvent.changeText(input, '987654');
  expect(onChangeText).toHaveBeenLastCalledWith('9876');
});

it('rule list is neutral before typing and reports each rule', async () => {
  const rules = [
    { id: 'length', label: 'At least 8 characters', met: false },
    { id: 'number', label: 'A number', met: true },
  ];
  const { rerender } = await render(<RuleList rules={rules} touched={false} />);
  expect(screen.getByLabelText('At least 8 characters, not yet')).toBeTruthy();
  expect(screen.getByLabelText('A number, not yet')).toBeTruthy();
  await rerender(<RuleList rules={rules} touched />);
  expect(screen.getByLabelText('A number, done')).toBeTruthy();
  expect(screen.getByLabelText('At least 8 characters, not yet')).toBeTruthy();
});

it.each(['welcome', 'find', 'pay', 'showUp'] as const)('renders the %s scene', async (name) => {
  await render(<Illustration name={name} />);
  // Decorative: hidden from screen readers, so the query must opt in to hidden elements.
  expect(screen.queryByTestId(`illustration-${name}`)).toBeNull();
  expect(
    screen.getByTestId(`illustration-${name}`, { includeHiddenElements: true }),
  ).toBeTruthy();
});
