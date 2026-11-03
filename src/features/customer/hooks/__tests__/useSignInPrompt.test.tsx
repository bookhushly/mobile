import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import type { SavedInput } from '@/features/customer/api/savedDb';

const HOTEL: SavedInput = {
  listingId: 'h1',
  kind: 'hotel',
  title: 'Harbour Suites',
  image: null,
  location: 'Ikeja, Lagos',
};

beforeEach(() => {
  useSignInPrompt.setState({ reason: null, pendingSave: null });
});

it('asking to save holds the item', () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  expect(useSignInPrompt.getState()).toMatchObject({ reason: 'save', pendingSave: HOTEL });
});

it('asking to book forgets any earlier item', () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().ask('book');
  expect(useSignInPrompt.getState()).toMatchObject({ reason: 'book', pendingSave: null });
});

it('dismiss closes and forgets', () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().dismiss();
  expect(useSignInPrompt.getState()).toMatchObject({ reason: null, pendingSave: null });
});

it('proceed closes and keeps the item', () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().proceed();
  expect(useSignInPrompt.getState()).toMatchObject({ reason: null, pendingSave: HOTEL });
});

it('clearPending leaves an open sheet open', () => {
  useSignInPrompt.getState().ask('save', HOTEL);
  useSignInPrompt.getState().clearPending();
  expect(useSignInPrompt.getState()).toMatchObject({ reason: 'save', pendingSave: null });
});
