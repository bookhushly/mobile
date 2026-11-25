import { View } from 'react-native';

import {
  SERVICE_TYPES,
  type LogisticsDraft,
} from '@/features/customer/domain/logistics/logisticsRequest';
import { PhotoRow } from '@/features/customer/ui/logistics/PhotoRow';
import { SERVICE_PHOTO } from '@/features/customer/ui/logistics/logisticsPhotos';
import { SERVICE } from '@/features/customer/ui/logistics/logisticsWords';
import { useDensity } from '@/shared/ui';

type Props = { draft: LogisticsDraft; onChange: (p: Partial<LogisticsDraft>) => void };

// Step 1 (design L1, layout A): the web's four services as full-width photo rows.
export function ServiceStep({ draft, onChange }: Props) {
  const d = useDensity();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="What do you need moved?"
      style={{ gap: d.targetGap }}
    >
      {SERVICE_TYPES.map((t) => (
        <PhotoRow
          key={t}
          title={SERVICE[t].label}
          line={SERVICE[t].line}
          photo={SERVICE_PHOTO[t]}
          checked={draft.serviceType === t}
          onPress={() => {
            onChange({ serviceType: t });
          }}
          testID={`logistics-service-${t}`}
        />
      ))}
    </View>
  );
}
