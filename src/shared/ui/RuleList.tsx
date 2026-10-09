import { Circle, CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type Rule = { id: string; label: string; met: boolean };

// Never red: an unmet rule is a to-do, not an error (spec §5). Labels come from the caller.
export function RuleList({ rules, touched }: { rules: Rule[]; touched: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: space.s2 }}>
      {rules.map((r) => {
        const done = touched && r.met;
        return (
          <View
            key={r.id}
            accessible
            accessibilityLabel={`${r.label}, ${done ? 'done' : 'not yet'}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}
          >
            <Icon
              as={done ? CircleCheck : Circle}
              size="xs"
              tone={done ? 'successFg' : 'textMuted'}
            />
            <Text variant="bodySm" tone={done ? 'successFg' : 'textSecondary'}>
              {r.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
