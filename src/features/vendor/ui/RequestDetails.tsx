import {
  Car,
  Clock,
  Package,
  ShieldCheck,
  StickyNote,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

import type { FactIcon, RequestDetail } from '@/features/vendor/domain/requests';
import { shortDate } from '@/shared/lib/lagosDay';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

const FACT_ICON: Record<FactIcon, LucideIcon> = {
  package: Package,
  truck: Truck,
  car: Car,
  users: Users,
  shield: ShieldCheck,
  clock: Clock,
  note: StickyNote,
};

function DateBox({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string | null;
}) {
  return (
    <View style={{ flex: 1, padding: space.s4, gap: space.s1 }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Text variant="label">{value}</Text>
      {detail === null ? null : (
        <Text variant="caption" tabular>
          {detail}
        </Text>
      )}
    </View>
  );
}

/** What was asked: the dates side by side, the details as icon rows, and the customer's own words. */
export function RequestDetails({ request: r }: { request: RequestDetail }) {
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          borderWidth: borderWidth.hairline,
          borderColor: color.border,
          borderRadius: radius.r4,
        }}
      >
        <DateBox label={r.start.label} value={shortDate(r.start.date)} detail={r.start.time} />
        {r.end === null ? null : (
          <>
            <View style={{ width: borderWidth.hairline, backgroundColor: color.border }} />
            <DateBox label={r.end.label} value={r.end.value} detail={r.end.detail} />
          </>
        )}
      </View>
      <View style={{ gap: space.s5 }}>
        {r.facts.map((f) => (
          <View key={f.title} style={{ flexDirection: 'row', gap: space.s4 }}>
            <Icon as={FACT_ICON[f.icon]} size="md" />
            <View style={{ flex: 1, gap: space.s1 }}>
              <Text variant="label">{f.title}</Text>
              {f.detail === null ? null : (
                <Text variant="caption" tone="textSecondary">
                  {f.detail}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
      {r.note === null ? null : (
        <View
          style={{
            backgroundColor: color.wash,
            borderRadius: radius.r4,
            padding: space.s5,
            gap: space.s2,
          }}
        >
          <Text variant="caption" tone="textSecondary">
            From the customer
          </Text>
          <Text variant="bodySm">{r.note}</Text>
        </View>
      )}
    </>
  );
}
