import { SectionList } from 'react-native';

import { POPULAR_PLACES, type Place } from '@/features/customer/domain/discover';
import { NIGERIAN_STATES } from '@/shared/lib/phone';
import { ListRow, SectionHeader, Sheet } from '@/shared/ui';

type Props = {
  visible: boolean;
  current: Place | null;
  onChoose: (p: Place) => void;
  onClose: () => void;
};

const same = (a: Place, b: Place | null) =>
  b !== null && a.label === b.label && a.state === b.state && a.city === b.city;

const SECTIONS = [
  { title: 'Popular places', key: 'popular', data: POPULAR_PLACES },
  {
    title: 'All states',
    key: 'states',
    data: NIGERIAN_STATES.map((s): Place => ({ label: s, state: s })),
  },
];

// Spec D6: "Where to?" — the popular places, then every state. No location permission in 4b.
export function PlaceSheet({ visible, current, onChoose, onClose }: Props) {
  // Lagos is both popular and a state: only one row reads as chosen.
  const popular = POPULAR_PLACES.some((p) => same(p, current));
  return (
    <Sheet visible={visible} title="Where to?" onClose={onClose} testID="place-sheet">
      <SectionList
        sections={SECTIONS}
        keyExtractor={(p, i) => `${p.label}:${p.state ?? ''}:${p.city ?? ''}:${String(i)}`}
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        renderSectionHeader={({ section }) => <SectionHeader label={section.title} />}
        renderItem={({ item, section }) => (
          <ListRow
            title={item.label}
            checked={same(item, current) && (section.key === 'popular') === popular}
            onPress={() => {
              onChoose(item);
            }}
          />
        )}
      />
    </Sheet>
  );
}
