import { ArrowDownUp, SlidersHorizontal } from 'lucide-react-native';
import { View } from 'react-native';

import { ChipButton } from '@/features/customer/ui/ChipButton';
import { resultCount } from '@/features/customer/ui/discoverLabels';
import { Text, useDensity } from '@/shared/ui';

type Props = {
  sortLabel: string;
  /** Filters on, sort excluded (the Sort chip shows it). */
  filterCount: number;
  /** The route's count; null → not shown (D2). */
  total: number | null;
  onSort: () => void;
  onFilters: () => void;
};

// Mobbin §3 (Tripadvisor, Agoda): Sort and Filters (n) chips with the result count on one line.
export function ResultsBar({ sortLabel, filterCount, total, onSort, onFilters }: Props) {
  const d = useDensity();
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: d.targetGap }}
    >
      <ChipButton label={`Sort: ${sortLabel}`} icon={ArrowDownUp} onPress={onSort} />
      <ChipButton
        label={filterCount > 0 ? `Filters (${String(filterCount)})` : 'Filters'}
        icon={SlidersHorizontal}
        active={filterCount > 0}
        onPress={onFilters}
      />
      {total !== null ? (
        <Text variant="bodySm" tone="textSecondary" tabular testID="results-count">
          {resultCount(total)}
        </Text>
      ) : null}
    </View>
  );
}
