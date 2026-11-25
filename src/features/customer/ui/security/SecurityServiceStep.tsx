import { ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import {
  SECURITY_SERVICES,
  type SecurityDraft,
} from '@/features/customer/domain/security/securityRequest';
import { PhotoRow } from '@/features/customer/ui/logistics/PhotoRow';
import { SECURITY_PHOTO } from '@/features/customer/ui/security/securityPhotos';
import { SECURITY_SERVICE } from '@/features/customer/ui/security/securityWords';
import { useDensity } from '@/shared/ui';

type Props = { draft: SecurityDraft; onChange: (p: Partial<SecurityDraft>) => void };

// Step 1 (layout A, as logistics): the web's five services as full-width photo rows.
export function SecurityServiceStep({ draft, onChange }: Props) {
  const d = useDensity();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="What do you need protected?"
      style={{ gap: d.targetGap }}
    >
      {SECURITY_SERVICES.map((s) => (
        <PhotoRow
          key={s}
          title={SECURITY_SERVICE[s].label}
          line={SECURITY_SERVICE[s].line}
          photo={SECURITY_PHOTO[s]}
          icon={ShieldCheck}
          checked={draft.service === s}
          onPress={() => {
            // A home or business pre-fills the property type (still changeable on Details).
            const pre =
              s === 'residential' ? 'residential' : s === 'corporate' ? 'commercial' : null;
            onChange(
              pre === null || draft.propertyType !== null
                ? { service: s }
                : { service: s, propertyType: pre },
            );
          }}
          testID={`security-service-${s}`}
        />
      ))}
    </View>
  );
}
