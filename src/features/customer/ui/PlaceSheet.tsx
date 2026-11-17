import { Map as MapIcon, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { SectionList } from 'react-native';

import {
  filterPlaces,
  placeRegion,
  POPULAR_PLACES,
  type Place,
} from '@/features/customer/domain/discover';
import { NIGERIAN_STATES } from '@/shared/lib/phone';
import { space } from '@/shared/theme';
import { Icon, ListRow, SearchField, SectionHeader, Sheet, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  current: Place | null;
  onChoose: (p: Place) => void;
  onClose: () => void;
};

const same = (a: Place, b: Place | null) =>
  b !== null && a.label === b.label && a.state === b.state && a.city === b.city;

const STATES: readonly Place[] = NIGERIAN_STATES.map((s): Place => ({ label: s, state: s }));
// Spec D6: "Where to?" — the popular places, then every state. No location permission in 4b.
// Layout after Skyscanner's destination sheet (owner's pick, 2026-11-15): a search field that
// filters both lists, popular places with a pin and the state they sit in, then all states.
export function PlaceSheet({ visible, current, onChoose, onClose }: Props) {
  const [query, setQuery] = useState('');
  // Lagos is both popular and a state: only one row reads as chosen.
  const popularChosen = POPULAR_PLACES.some((p) => same(p, current));
  const sections = [
    { title: 'Popular places', key: 'popular', data: filterPlaces(POPULAR_PLACES, query) },
    { title: 'All states', key: 'states', data: filterPlaces(STATES, query) },
  ].filter((s) => s.data.length > 0);
  const close = () => {
    setQuery('');
    onClose();
  };
  return (
    <Sheet visible={visible} title="Where to?" onClose={close} testID="place-sheet">
      <SearchField
        label="Find a city or state"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
        testID="place-search"
      />
      {sections.length === 0 ? (
        <Text variant="bodySm" tone="textSecondary" style={{ paddingTop: space.s4 }}>
          {`No city or state matches “${query.trim()}”.`}
        </Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(p, i) => `${p.label}:${p.state ?? ''}:${p.city ?? ''}:${String(i)}`}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          renderSectionHeader={({ section }) => <SectionHeader label={section.title} />}
          renderItem={({ item, section }) => {
            const popular = section.key === 'popular';
            const region = popular ? placeRegion(item) : null;
            return (
              <ListRow
                title={item.label}
                {...(region === null ? {} : { subtitle: region })}
                leading={<Icon as={popular ? MapPin : MapIcon} size="md" />}
                checked={same(item, current) && popular === popularChosen}
                onPress={() => {
                  setQuery('');
                  onChoose(item);
                }}
              />
            );
          }}
        />
      )}
    </Sheet>
  );
}
