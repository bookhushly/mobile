import { View } from 'react-native';

import type { Category, Filters } from '@/features/customer/domain/discover';
import { SORTS, sortLabel } from '@/features/customer/ui/discoverLabels';
import { ListRow, Sheet } from '@/shared/ui';

type Sort = Filters['sort'];
type Props = {
  visible: boolean;
  category: Category;
  value: Sort;
  /** A single choice: picking one applies it (Booking.com). */
  onChoose: (s: Sort) => void;
  onClose: () => void;
};

export function SortSheet({ visible, category, value, onChoose, onClose }: Props) {
  return (
    <Sheet visible={visible} title="Sort by" onClose={onClose} testID="sort-sheet">
      <View accessibilityRole="radiogroup" accessibilityLabel="Sort by">
        {SORTS.map((s) => (
          <ListRow
            key={s}
            title={sortLabel(category, s)}
            checked={value === s}
            onPress={() => {
              onChoose(s);
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
