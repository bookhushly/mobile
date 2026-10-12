import { fireEvent, render, screen } from '@testing-library/react-native';

import { borderWidth, color, radius } from '@/shared/theme';
import { FilterChips } from '@/shared/ui/FilterChips';
import { ListRow } from '@/shared/ui/ListRow';

const OPTIONS = [
  { value: 'all', label: 'All', count: 24 },
  { value: 'dirty', label: 'Dirty', count: 3 },
  { value: 'reserved', label: 'Reserved' },
] as const;

it('filter chips are a single-choice group with counts in the label', async () => {
  const onChange = jest.fn();
  await render(
    <FilterChips label="Room status" value="all" options={OPTIONS} onChange={onChange} />,
  );
  // The group is a container (not one accessible element), so it is found by its label.
  expect(screen.getByLabelText('Room status').props.accessibilityRole).toBe('radiogroup');
  expect(screen.getByRole('radio', { name: 'All 24', checked: true })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Reserved', checked: false })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Dirty 3' }));
  expect(onChange).toHaveBeenCalledWith('dirty');
});

it('each chip is at least a 44 pt target; the chosen one is wash + violet with a heavier border', async () => {
  await render(
    <FilterChips label="Room status" value="dirty" options={OPTIONS} onChange={jest.fn()} />,
  );
  expect(screen.getByRole('radio', { name: 'All 24' })).toHaveStyle({ minHeight: 44 });
  expect(screen.getByRole('radio', { name: 'Dirty 3' })).toHaveStyle({
    backgroundColor: color.wash,
    borderColor: color.actionPressed,
    borderWidth: borderWidth.thick,
    borderRadius: radius.r2,
  });
  expect(screen.getByRole('radio', { name: 'All 24' })).toHaveStyle({
    backgroundColor: color.surface,
    borderWidth: borderWidth.hairline,
  });
  expect(screen.getByText('Dirty 3')).toHaveStyle({ color: color.linkText });
});

it('a list row can be a radio option', async () => {
  const onPress = jest.fn();
  await render(
    <>
      <ListRow title="Available" checked onPress={onPress} />
      <ListRow title="Dirty" checked={false} onPress={onPress} />
    </>,
  );
  expect(screen.getByRole('radio', { name: 'Available', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Dirty', checked: false }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button')).toBeNull();
});
