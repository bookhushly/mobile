import { useState } from 'react';
import { View } from 'react-native';

import type { Category, Filters, PickedDate } from '@/features/customer/domain/discover';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import { SORTS, sortLabel } from '@/features/customer/ui/discoverLabels';
import { isIsoDate, shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Button, FilterChips, Input, ListRow, SectionHeader, Sheet } from '@/shared/ui';

type Props = {
  visible: boolean;
  category: Category;
  value: Filters;
  /** Today in Lagos, for the event date choices. */
  today: IsoDate;
  onApply: (f: Filters) => void;
  onClose: () => void;
};

export const NO_FILTERS: Filters = { sort: 'newest' };
const PICK_DAYS = 30;
const DAY_MS = 86_400_000;

const isPicked = (s: string): s is PickedDate => isIsoDate(s);
const digits = (t: string) => t.replace(/\D/g, '').slice(0, 9);
const toText = (n: number | undefined) => (n === undefined ? '' : String(n));
const toNaira = (t: string) => (t === '' || Number(t) < 1 ? undefined : Number(t));
const nextDays = (today: IsoDate) =>
  Array.from({ length: PICK_DAYS }, (_, i) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + (i + 1) * DAY_MS).toISOString().slice(0, 10),
  ).filter(isPicked);

// Drops unset keys, so the same filters always make the same query key.
function tidy(f: Filters): Filters {
  const out: Filters = { sort: f.sort };
  const entries: [string, unknown][] = Object.entries(f);
  for (const [k, v] of entries) if (v !== undefined) Reflect.set(out, k, v);
  return out;
}

type Rating = 'any' | '3' | '4' | '4.5';
type Beds = 'any' | '1' | '2' | '3';
type When = 'any' | 'today' | 'weekend' | 'pick';
const RATINGS = [
  { value: 'any', label: 'Any' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
  { value: '4.5', label: '4.5+' },
] as const;
const BEDS = [
  { value: 'any', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
] as const;
const WHENS = [
  { value: 'any', label: 'Any' },
  { value: 'today', label: 'Today' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'pick', label: 'Pick a date' },
] as const;
const RATING_OF = { any: undefined, '3': 3, '4': 4, '4.5': 4.5 } as const;
const BEDS_OF = { any: undefined, '1': 1, '2': 2, '3': 3 } as const;
const ratingKey = (r: Filters['minRating']): Rating =>
  r === undefined ? 'any' : r === 3 ? '3' : r === 4 ? '4' : '4.5';
const bedsKey = (b: Filters['bedrooms']): Beds =>
  b === undefined ? 'any' : b === 1 ? '1' : b === 2 ? '2' : '3';

// Spec D8; Mobbin §3 (Expedia, Skyscanner, Airbnb). A draft until Show results. Hotels never get
// bed size, floor or dates: the route can't read rooms, so those return nothing (R1).
export function FiltersSheet({ visible, category, value, today, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<Filters>(value);
  const [minText, setMinText] = useState(toText(value.priceMin));
  const [maxText, setMaxText] = useState(toText(value.priceMax));
  const [priceError, setPriceError] = useState<string | undefined>(undefined);
  const [shown, setShown] = useState(visible);
  // Each opening starts from what is applied.
  if (visible !== shown) {
    setShown(visible);
    if (visible) {
      setDraft(value);
      setMinText(toText(value.priceMin));
      setMaxText(toText(value.priceMax));
      setPriceError(undefined);
    }
  }
  const set = (patch: Partial<Filters>) => {
    setDraft({ ...draft, ...patch });
  };

  const show = () => {
    const priceMin = toNaira(minText);
    const priceMax = toNaira(maxText);
    if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
      setPriceError('The maximum must be at least the minimum.');
      return;
    }
    onApply(tidy({ ...draft, priceMin, priceMax }));
  };
  const clearAll = () => {
    setDraft(NO_FILTERS);
    setMinText('');
    setMaxText('');
    setPriceError(undefined);
  };

  const d = draft.eventDate;
  const when: When = d === undefined ? 'any' : d === 'today' || d === 'weekend' ? d : 'pick';
  const days = when === 'pick' ? nextDays(today) : [];
  const picked = d !== undefined && isPicked(d) ? d : undefined;

  return (
    <Sheet
      visible={visible}
      title="Filters"
      onClose={onClose}
      scroll
      testID="filters-sheet"
      footer={
        <View style={{ flexDirection: 'row', gap: space.s3 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" label="Clear all" onPress={clearAll} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Show results" onPress={show} />
          </View>
        </View>
      }
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Sort by">
        <SectionHeader label="Sort by" />
        {SORTS.map((s) => (
          <ListRow
            key={s}
            title={sortLabel(category, s)}
            checked={draft.sort === s}
            onPress={() => {
              set({ sort: s });
            }}
          />
        ))}
      </View>
      <SectionHeader label={category === 'events' ? 'Ticket price' : 'Price per night'} />
      <View style={{ flexDirection: 'row', gap: space.s3 }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Minimum (₦)"
            value={minText}
            onChangeText={(t) => {
              setMinText(digits(t));
              setPriceError(undefined);
            }}
            keyboardType="number-pad"
            placeholder="No minimum"
            testID="price-min"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Maximum (₦)"
            value={maxText}
            error={priceError}
            onChangeText={(t) => {
              setMaxText(digits(t));
              setPriceError(undefined);
            }}
            keyboardType="number-pad"
            placeholder="No maximum"
            testID="price-max"
          />
        </View>
      </View>
      {category === 'hotels' ? (
        <>
          <SectionHeader label="Guest rating" />
          <FilterChips<Rating>
            label="Guest rating"
            value={ratingKey(draft.minRating)}
            options={RATINGS}
            onChange={(r) => {
              set({ minRating: RATING_OF[r] });
            }}
          />
          <CheckRow
            label="Breakfast included"
            checked={draft.breakfastIncluded === true}
            onChange={(b) => {
              set({ breakfastIncluded: b || undefined });
            }}
          />
          <CheckRow
            label="24 h generator"
            checked={draft.generator24h === true}
            onChange={(b) => {
              set({ generator24h: b || undefined });
            }}
          />
        </>
      ) : null}
      {category === 'serviced_apartments' ? (
        <>
          <SectionHeader label="Bedrooms" />
          <FilterChips<Beds>
            label="Bedrooms"
            value={bedsKey(draft.bedrooms)}
            options={BEDS}
            onChange={(b) => {
              set({ bedrooms: BEDS_OF[b] });
            }}
          />
          <CheckRow
            label="Furnished"
            checked={draft.furnished === true}
            onChange={(b) => {
              set({ furnished: b || undefined });
            }}
          />
          <CheckRow
            label="Generator"
            checked={draft.generator === true}
            onChange={(b) => {
              set({ generator: b || undefined });
            }}
          />
        </>
      ) : null}
      {category === 'events' ? (
        <>
          <SectionHeader label="Date" />
          <FilterChips<When>
            label="Date"
            value={when}
            options={WHENS}
            onChange={(w) => {
              set({ eventDate: w === 'any' ? undefined : w === 'pick' ? nextDays(today)[0] : w });
            }}
          />
          {picked !== undefined ? (
            <FilterChips<PickedDate>
              label="Pick a date"
              value={picked}
              options={days.map((x) => ({ value: x, label: shortDate(x) }))}
              onChange={(x) => {
                set({ eventDate: x });
              }}
              testID="pick-date"
            />
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
