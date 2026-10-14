import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ListingCardModel } from '@/features/customer/domain/listingCard';
import { ListingCard } from '@/features/customer/ui/ListingCard';
import { borderWidth, color } from '@/shared/theme';

const HOTEL: ListingCardModel = {
  kind: 'hotel',
  id: 'h1',
  title: 'Harbour Suites',
  area: 'Ikeja, Lagos',
  image: 'https://cdn.test/h1.jpg',
  rating: { avg: 4.6, count: 23 },
  price: { amount: 45000, unit: 'night', prefix: 'From' },
  when: null,
};
const EVENT: ListingCardModel = {
  kind: 'event',
  id: 'e1',
  title: 'Afrobeats night',
  area: 'Eko Hotel, Lagos',
  image: null,
  rating: null,
  price: { min: 0, max: 5000 },
  when: 'Sat 17 Oct · 7:00 pm',
};

it('a hotel card shows title, area, rating, price and opens', async () => {
  const onOpen = jest.fn();
  await render(
    <ListingCard
      listing={HOTEL}
      variant="rail"
      saved={false}
      savedReady
      onOpen={onOpen}
      onToggleSaved={jest.fn()}
    />,
  );
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.getByText('4.6 (23)')).toBeTruthy();
  expect(screen.getByText('From ₦45,000')).toBeTruthy();
  expect(screen.getByText('/ night')).toBeTruthy();
  const card = screen.getByRole('button', {
    name: 'Harbour Suites, Ikeja, Lagos, Rated 4.6 out of 5, 23 reviews, From 45,000 naira per night',
  });
  await fireEvent.press(card);
  expect(onOpen).toHaveBeenCalledWith(HOTEL);
  // Cards use the first https image, cached and recycled per listing (D14).
  const img = screen.getByTestId('listing-image-h1');
  expect(img.props.source).toEqual([expect.objectContaining({ uri: 'https://cdn.test/h1.jpg' })]);
});

it('a hotel with price 0 says "See rooms for prices", never ₦0', async () => {
  await render(
    <ListingCard
      listing={{ ...HOTEL, price: { text: 'See rooms for prices' } }}
      variant="row"
      saved={false}
      savedReady
      onOpen={jest.fn()}
      onToggleSaved={jest.fn()}
    />,
  );
  expect(screen.getByText('See rooms for prices')).toBeTruthy();
  expect(screen.queryByText(/₦0/)).toBeNull();
});

it('an event card shows its date chip instead of a rating, and a price range', async () => {
  await render(
    <ListingCard
      listing={EVENT}
      variant="grid"
      saved={false}
      savedReady
      onOpen={jest.fn()}
      onToggleSaved={jest.fn()}
    />,
  );
  expect(screen.getByText('Sat 17 Oct · 7:00 pm')).toBeTruthy();
  // U5: a tag, not a chip — no border, so it never reads as a button.
  const tag = screen.getByTestId('event-when');
  expect(tag).not.toHaveStyle({ borderWidth: borderWidth.hairline });
  expect(tag).toHaveStyle({ backgroundColor: color.wash });
  // D5: a free tier next to paid ones reads "Free", never "₦0".
  expect(screen.getByText('Free – ₦5,000')).toBeTruthy();
  expect(screen.queryByText(/₦0/)).toBeNull();
  expect(screen.getByLabelText('Free to 5,000 naira')).toBeTruthy();
  expect(screen.queryByText(/out of 5/)).toBeNull();
});

it('the heart is a toggle with its state and the right label', async () => {
  const onToggleSaved = jest.fn();
  const view = await render(
    <ListingCard
      listing={HOTEL}
      variant="rail"
      saved={false}
      savedReady
      onOpen={jest.fn()}
      onToggleSaved={onToggleSaved}
    />,
  );
  const heart = screen.getByRole('button', { name: 'Save Harbour Suites' });
  expect(heart.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
  await fireEvent.press(heart);
  expect(onToggleSaved).toHaveBeenCalledWith(HOTEL);
  await view.rerender(
    <ListingCard
      listing={HOTEL}
      variant="rail"
      saved
      savedReady
      onOpen={jest.fn()}
      onToggleSaved={onToggleSaved}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Remove Harbour Suites from saved', selected: true }),
  ).toBeTruthy();
});

it('the heart waits while the saved list loads', async () => {
  await render(
    <ListingCard
      listing={HOTEL}
      variant="row"
      saved={false}
      savedReady={false}
      onOpen={jest.fn()}
      onToggleSaved={jest.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Save Harbour Suites', disabled: true })).toBeTruthy();
});
