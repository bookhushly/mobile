import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { StarRating } from '@/features/customer/ui/StarRating';

function Harness({ onChange }: { onChange: (n: number) => void }) {
  const [value, setValue] = useState(0);
  return (
    <StarRating
      value={value}
      onChange={(n) => {
        setValue(n);
        onChange(n);
      }}
    />
  );
}

it('is a radio group of five stars, each ≥ 44 pt, with the word under it', async () => {
  const onChange = jest.fn();
  await render(<Harness onChange={onChange} />);
  expect(screen.getByLabelText('Rating, not set')).toBeTruthy();
  const stars = screen.getAllByRole('radio');
  expect(stars).toHaveLength(5);
  for (const s of stars) {
    expect(s).toHaveStyle({ minWidth: 44, minHeight: 44 });
    // U2: no hit area reaches into the next star.
    expect(s.props.hitSlop).toBeUndefined();
  }
  expect(screen.getByTestId('star-rating')).toHaveStyle({ gap: 12 });

  await fireEvent.press(screen.getByRole('radio', { name: '4 of 5, Very good' }));
  expect(onChange).toHaveBeenCalledWith(4);
  expect(screen.getByLabelText('Rating, 4 of 5, Very good')).toBeTruthy();
  expect(screen.getByRole('radio', { name: '4 of 5, Very good' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '5 of 5, Excellent' })).not.toBeChecked();
  expect(screen.getByText('Very good')).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: '1 of 5, Poor' }));
  expect(screen.getByText('Poor')).toBeTruthy();
});
