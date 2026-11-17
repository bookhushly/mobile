import { Plug, Sofa } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { Category, Filters, PickedDate } from '@/features/customer/domain/discover';
import type { ListingsWhere } from '@/features/customer/hooks/customerKeys';
import { useDebounced } from '@/features/customer/hooks/useDebounced';
import { useListingsRail } from '@/features/customer/hooks/useListings';
import {
  BEDS,
  BEDS_OF,
  bedsKey,
  isPicked,
  nextDays,
  NO_FILTERS,
  tidy,
  toNaira,
  toText,
  WHENS,
  type Beds,
  type When,
} from '@/features/customer/ui/filterOptions';
import { FilterSection } from '@/features/customer/ui/FilterSection';
import { HotelFilterFields, HotelMostWanted } from '@/features/customer/ui/HotelFilterFields';
import { PriceRangeFields } from '@/features/customer/ui/PriceRangeFields';
import { ToggleTile } from '@/features/customer/ui/ToggleTile';
import { shortDate, type IsoDate } from '@/shared/lib/lagosDay';
import { space } from '@/shared/theme';
import { Button, FilterChips, Sheet, TextLink } from '@/shared/ui';

const TILE_ROW = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.s3 };

type Props = {
  visible: boolean;
  category: Category;
  /** The search the results are for: the live count asks for the same place and words. */
  where: ListingsWhere;
  value: Filters;
  /** Today in Lagos, for the event date choices. */
  today: IsoDate;
  onApply: (f: Filters) => void;
  onClose: () => void;
};

// Spec D8; laid out after Airbnb's filters (owner's pick A, 2026-11-15). A draft until Show results,
// whose label counts what the draft would show ("Show 12 hotels"), asked half a second after the
// last change. Sort lives in its own pill on Results, not here. Hotels never get bed size, floor or
// dates: the route can't read rooms, so those return nothing (R1).
const NOUN: Record<Category, [string, string]> = {
  hotels: ['hotel', 'hotels'],
  serviced_apartments: ['apartment', 'apartments'],
  events: ['event', 'events'],
};
// Naira bands for a night (owner, 2026-11-15: the price guests think in first).
const BANDS = [
  { label: 'Under ₦50k', min: '', max: '50000' },
  { label: '₦50k–₦100k', min: '50000', max: '100000' },
  { label: '₦100k+', min: '100000', max: '' },
] as const;
export function FiltersSheet({ visible, category, where, value, today, onApply, onClose }: Props) {
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

  // The live count: the draft as it would apply (a bad price range asks for nothing).
  const min = toNaira(minText);
  const max = toNaira(maxText);
  const current =
    min !== undefined && max !== undefined && min > max
      ? null
      : tidy({ ...draft, priceMin: min, priceMax: max });
  const asked = useDebounced(current, 500);
  const live = useListingsRail(category, where, asked ?? draft, {
    enabled: visible && asked !== null,
  });
  const settled = asked !== null && JSON.stringify(asked) === JSON.stringify(current);
  const n = settled && !live.loading && !live.failed ? live.totalCount : null;
  const showLabel =
    n === null ? 'Show results' : `Show ${String(n)} ${NOUN[category][n === 1 ? 0 : 1]}`;

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
        // Airbnb: "Clear all" as a quiet link, the one action as the button.
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s5 }}>
          <TextLink label="Clear all" size="lg" onPress={clearAll} />
          <View style={{ flex: 1 }}>
            <Button label={showLabel} onPress={show} testID="filters-show" />
          </View>
        </View>
      }
    >
      {category === 'hotels' ? <HotelMostWanted draft={draft} set={set} /> : null}
      <FilterSection
        title={category === 'events' ? 'Ticket price' : 'Price per night'}
        subtitle="In naira, before fees"
      >
        {category !== 'events' ? (
          <FilterChips
            label="Price band"
            value={BANDS.find((x) => x.min === minText && x.max === maxText)?.label ?? ''}
            options={BANDS.map((x) => ({ value: x.label, label: x.label }))}
            onChange={(label) => {
              const band = BANDS.find((x) => x.label === label);
              if (band === undefined) return;
              setMinText(band.min);
              setMaxText(band.max);
              setPriceError(undefined);
            }}
            testID="price-bands"
          />
        ) : null}
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
      </FilterSection>
      {category === 'hotels' ? <HotelFilterFields draft={draft} set={set} /> : null}
      {category === 'serviced_apartments' ? (
        <>
          <FilterSection title="Bedrooms">
            <FilterChips<Beds>
              label="Bedrooms"
              value={bedsKey(draft.bedrooms)}
              options={BEDS}
              onChange={(b) => {
                set({ bedrooms: BEDS_OF[b] });
              }}
            />
          </FilterSection>
          <FilterSection title="Amenities">
            <View style={TILE_ROW}>
              <ToggleTile
                icon={Sofa}
                label="Furnished"
                checked={draft.furnished === true}
                onChange={(b) => {
                  set({ furnished: b || undefined });
                }}
              />
              <ToggleTile
                icon={Plug}
                label="Generator"
                checked={draft.generator === true}
                onChange={(b) => {
                  set({ generator: b || undefined });
                }}
              />
            </View>
          </FilterSection>
        </>
      ) : null}
      {category === 'events' ? (
        <>
          <FilterSection title="Date">
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
          </FilterSection>
        </>
      ) : null}
    </Sheet>
  );
}
