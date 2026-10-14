import { ArrowLeft, MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { POPULAR_PLACES, sanitizeSearch, type Category } from '@/features/customer/domain/discover';
import { useRecentSearches } from '@/features/customer/hooks/useRecentSearches';
import type { RecentSearch } from '@/features/customer/offline/recentSearches';
import { CATEGORY_LABEL, CATEGORY_OPTIONS } from '@/features/customer/ui/discoverLabels';
import { RecentSearchRow } from '@/features/customer/ui/RecentSearchRow';
import {
  Header,
  Icon,
  IconButton,
  ListRow,
  Screen,
  SearchField,
  SectionHeader,
  SegmentedControl,
} from '@/shared/ui';

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

const keyOf = (e: RecentSearch) => `${e.category}:${e.q ?? ''}:${e.state ?? ''}:${e.city ?? ''}`;

// Spec D3/D7; Mobbin §2 (Marriott recents, Shangri-La popular places). A search runs only on
// submit or on tapping a recent or popular item, never per keystroke.
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
      <SegmentedControl
        value={category}
        options={CATEGORY_OPTIONS}
        onChange={setCategory}
        testID="search-category"
      />
      {typed !== '' ? (
        <ListRow
          title={`Search “${typed}”`}
          subtitle={CATEGORY_LABEL[category]}
          leading={<Icon as={Search} size="sm" tone="textMuted" />}
          onPress={submit}
          testID="search-submit-row"
        />
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
            <SectionHeader label={`Popular places · ${CATEGORY_LABEL[category]}`} />
            {POPULAR_PLACES.map((p) => (
              <ListRow
                key={p.label}
                title={p.label}
                accessibilityLabel={`${p.label}, ${CATEGORY_LABEL[category]}`}
                leading={<Icon as={MapPin} size="sm" tone="textMuted" />}
                onPress={() => {
                  go({
                    label: p.label,
                    category,
                    ...(p.state !== undefined ? { state: p.state } : {}),
                    ...(p.city !== undefined ? { city: p.city } : {}),
                  });
                }}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
