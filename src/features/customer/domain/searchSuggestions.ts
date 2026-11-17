import { POPULAR_PLACES, placeRegion, type Place } from '@/features/customer/domain/discover';

// The areas people book in, per popular place (search direction A, owner's pick 2026-11-15, after
// Airbnb's suggested destinations: a city with what it's known for). Real, well-known
// neighbourhoods only. The listings route matches `search` against name, city, state and address
// (and area for apartments), so an area searched within its place finds what's there.
const AREAS: Readonly<Record<string, readonly string[]>> = {
  Lagos: ['Lekki', 'Ikoyi', 'Victoria Island', 'Ikeja'],
  Abuja: ['Wuse', 'Maitama', 'Garki', 'Asokoro'],
  'Port Harcourt': ['GRA', 'Trans-Amadi', 'Rumuola'],
  Ibadan: ['Bodija', 'Ring Road', 'Jericho'],
  Enugu: ['Independence Layout', 'New Haven', 'GRA'],
  Kano: ['Nassarawa GRA', 'Bompai'],
  Uyo: ['Ewet Housing', 'Shelter Afrique'],
  Calabar: ['Marian', 'Diamond Hill', 'State Housing'],
};

const MAX = 6;

/** The areas a popular place is known for; none for any other place. */
export function placeAreas(p: Place): readonly string[] {
  return AREAS[p.label] ?? [];
}

export type Suggestion =
  { kind: 'place'; place: Place } | { kind: 'area'; area: string; place: Place };

/**
 * What to offer while typing: popular places whose name or state matches (those starting with the
 * text first), then areas that match, each tied to its place. Short, and nothing for blank text.
 */
export function searchSuggestions(text: string): Suggestion[] {
  const q = text.trim().toLowerCase();
  if (q === '') return [];
  const starts = (s: string) => s.toLowerCase().startsWith(q);
  const has = (s: string) => s.toLowerCase().includes(q);

  const places = POPULAR_PLACES.filter((p) => has(p.label) || has(placeRegion(p) ?? ''));
  const ordered = [
    ...places.filter((p) => starts(p.label)),
    ...places.filter((p) => !starts(p.label)),
  ];
  const areas: Suggestion[] = POPULAR_PLACES.flatMap((place) =>
    placeAreas(place)
      .filter(has)
      .map((area) => ({ kind: 'area' as const, area, place })),
  );
  return [...ordered.map((place) => ({ kind: 'place' as const, place })), ...areas].slice(0, MAX);
}
