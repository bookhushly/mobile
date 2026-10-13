import { useState } from 'react';
import { View } from 'react-native';

import type { Category, Filters, PickedDate } from '@/features/customer/domain/discover';
import { CheckRow } from '@/features/customer/ui/CheckRow';
import {
  BEDS,
  BEDS_OF,
  bedsKey,
  isPicked,
  nextDays,
  NO_FILTERS,
  RATING_OF,
  RATINGS,
  ratingKey,
  tidy,
  toNaira,
  toText,
  WHENS,
  type Beds,
  type Rating,
  type When,
} from '@/features/customer/ui/filterOptions';
import { PriceRangeFields } from '@/features/customer/ui/PriceRangeFields';
import { SORTS, sortLabel } from '@/features/customer/ui/discoverLabels';
import { shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Button, FilterChips, ListRow, SectionHeader, Sheet } from '@/shared/ui';

type Props = {
  visible: boolean;
  category: Category;
  value: Filters;
  /** Today in Lagos, for the event date choices. */
  today: IsoDate;
  onApply: (f: Filters) => void;
  onClose: () => void;
};

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
      <PriceRangeFields
        min={minText}
        max={maxText}
        error={priceError}
        onChange={(next) => {
          setMinText(next.min);
          setMaxText(next.max);
          setPriceError(undefined);
        }}
      />
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
