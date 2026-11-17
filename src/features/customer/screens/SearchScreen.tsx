import { ArrowLeft, MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  POPULAR_PLACES,
  placeRegion,
  sanitizeSearch,
  type Category,
  type Place,
} from '@/features/customer/domain/discover';
import { placeAreas, searchSuggestions } from '@/features/customer/domain/searchSuggestions';
import { useRecentSearches } from '@/features/customer/hooks/useRecentSearches';
import type { RecentSearch } from '@/features/customer/offline/recentSearches';
import { CategoryTabs } from '@/features/customer/ui/CategoryTabs';
import { CATEGORY_LABEL } from '@/features/customer/ui/discoverLabels';
import { RecentSearchRow } from '@/features/customer/ui/RecentSearchRow';
import { space } from '@/shared/theme';
import { Header, Icon, IconButton, ListRow, Screen, SearchField, SectionHeader } from '@/shared/ui';

/** Where a search goes: `/results` params (the state travels as `region`). */
export type SearchTarget = { category: Category; q?: string; region?: string; city?: string };

type Props = {
  userId: string;
  initialCategory?: Category;
  /** The query to change (from an empty Results list). */
  initialText?: string;
  onBack: () => void;
  onSearch: (t: SearchTarget) => void;
};

const targetOf = (e: RecentSearch): SearchTarget => ({
  category: e.category,
  ...(e.q !== undefined ? { q: e.q } : {}),
  ...(e.state !== undefined ? { region: e.state } : {}),
  ...(e.city !== undefined ? { city: e.city } : {}),
});

const whereOf = (p: Place) => ({
  ...(p.state !== undefined ? { state: p.state } : {}),
  ...(p.city !== undefined ? { city: p.city } : {}),
});

const keyOf = (e: RecentSearch) => `${e.category}:${e.q ?? ''}:${e.state ?? ''}:${e.city ?? ''}`;

// Spec D3/D7. Search direction A (owner's pick, 2026-11-15, after Airbnb's suggested destinations):
// the kind as tabs with icons, one field, then recent searches and suggested places as rows (the
// city and the areas people book in). Typing turns the list into matching places and areas, then a
// search by name. A search runs only on submit or a tap, never per keystroke.
export function SearchScreen({
  userId,
  initialCategory = 'hotels',
  initialText = '',
  onBack,
  onSearch,
}: Props) {
  const recent = useRecentSearches(userId);
  const [text, setText] = useState(initialText);
  const [category, setCategory] = useState<Category>(initialCategory);
  const typed = sanitizeSearch(text);

  const go = (e: RecentSearch) => {
    // Saved in the background: the search never waits on the disk.
    void recent.add(e);
    onSearch(targetOf(e));
  };
  const submit = () => {
    if (typed === '') return;
    go({ label: typed, category, q: typed });
  };

  const where = (p: Place) => () => {
    go({ label: p.label, category, ...whereOf(p) });
  };
  const suggestions = searchSuggestions(typed);
  const kind = CATEGORY_LABEL[category];

  return (
    <Screen
      scroll
      header={
        <Header
          title="Search"
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
    >
      <View style={{ gap: space.s5 }}>
        <CategoryTabs value={category} onChange={setCategory} testID="search-category" />
        <SearchField
          label="Where or what"
          placeholder="A city, area or name"
          value={text}
          onChangeText={setText}
          onSubmit={submit}
          autoFocus
          autoCapitalize="words"
          testID="search-field"
        />
      </View>
      {typed !== '' ? (
        <View>
          {suggestions.map((sg) =>
            sg.kind === 'place' ? (
              <ListRow
                key={`place:${sg.place.label}`}
                title={sg.place.label}
                subtitle={placeRegion(sg.place) ?? undefined}
                leading={<Icon as={MapPin} />}
                accessibilityLabel={`${sg.place.label}, ${kind}`}
                onPress={where(sg.place)}
              />
            ) : (
              <ListRow
                key={`area:${sg.place.label}:${sg.area}`}
                title={sg.area}
                subtitle={`Area in ${sg.place.label}`}
                leading={<Icon as={MapPin} />}
                accessibilityLabel={`${sg.area}, ${sg.place.label}, ${kind}`}
                onPress={() => {
                  // The area searched within its place (the route matches it in the address).
                  go({
                    label: `${sg.area}, ${sg.place.label}`,
                    category,
                    q: sg.area,
                    ...whereOf(sg.place),
                  });
                }}
              />
            ),
          )}
          <ListRow
            title={`Search “${typed}”`}
            subtitle={`${kind} by name or address`}
            leading={<Icon as={Search} />}
            accessibilityLabel={`Search “${typed}”, ${kind}`}
            onPress={submit}
            testID="search-submit-row"
          />
        </View>
      ) : (
        <>
          {recent.items.length > 0 ? (
            <View>
              <SectionHeader label="Recent searches" />
              {recent.items.map((e) => (
                <RecentSearchRow
                  key={keyOf(e)}
                  item={e}
                  onPress={go}
                  onRemove={(r) => {
                    void recent.remove(r);
                  }}
                />
              ))}
            </View>
          ) : null}
          <View>
            <SectionHeader label="Suggested places" />
            {POPULAR_PLACES.map((p) => (
              <ListRow
                key={p.label}
                title={p.label}
                subtitle={placeAreas(p).join(', ')}
                leading={<Icon as={MapPin} />}
                accessibilityLabel={`${p.label}, ${kind}`}
                onPress={where(p)}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
