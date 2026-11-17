import { POPULAR_PLACES } from '@/features/customer/domain/discover';
import { placeAreas, searchSuggestions } from '@/features/customer/domain/searchSuggestions';

const lagos = POPULAR_PLACES.find((p) => p.label === 'Lagos');

it('names the areas people book in for each popular place', () => {
  for (const p of POPULAR_PLACES) expect(placeAreas(p).length).toBeGreaterThan(0);
  expect(placeAreas({ label: 'Lagos', state: 'Lagos' })).toContain('Lekki');
  // A place the app doesn't know has none.
  expect(placeAreas({ label: 'Ogun', state: 'Ogun' })).toEqual([]);
});

it('suggests nothing for blank text', () => {
  expect(searchSuggestions('')).toEqual([]);
  expect(searchSuggestions('   ')).toEqual([]);
});

it('suggests places by name or state, then areas, ignoring case', () => {
  expect(searchSuggestions('lag')).toEqual([{ kind: 'place', place: lagos }]);
  // "Rivers" is Port Harcourt's state.
  expect(searchSuggestions('rivers').map((s) => s.place.label)).toEqual(['Port Harcourt']);
  expect(searchSuggestions('lek')).toEqual([{ kind: 'area', area: 'Lekki', place: lagos }]);
});

it('lists places that start with the text before ones that only contain it', () => {
  const labels = searchSuggestions('a').map((s) => (s.kind === 'area' ? s.area : s.place.label));
  expect(labels[0]).toBe('Abuja');
});

it('keeps the list short', () => {
  expect(searchSuggestions('a').length).toBeLessThanOrEqual(6);
});
