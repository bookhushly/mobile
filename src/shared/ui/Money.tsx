import type { Variant } from '@/shared/theme';

import { formatNaira } from './formatNaira';
import { Text } from './Text';

export function Money({ amount, variant = 'num' }: { amount: number; variant?: Variant }) {
  return (
    <Text variant={variant} tabular>
      {formatNaira(amount)}
    </Text>
  );
}
