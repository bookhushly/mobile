import { Circle, CircleCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { announce } from './announce';
import { Icon } from './Icon';
import { Text } from './Text';

type Rule = { id: string; label: string; met: boolean };
type Changed = { id: string; text: string };
type Snapshot = { key: string; changed: Changed[] };

function rowText(label: string, done: boolean): string {
  return `${label}, ${done ? 'done' : 'not yet'}`;
}

// Never red: an unmet rule is a to-do, not an error (spec §5). Labels come from the caller.
// Only a row that changed is announced: Android gets the live region on that row, iOS an
// announcement, so a keystroke never re-reads the whole list.
export function RuleList({ rules, touched }: { rules: Rule[]; touched: boolean }) {
  const rows = rules.map((r) => ({ ...r, done: touched && r.met }));
  const key = rows.map((r) => `${r.id}:${r.done ? '1' : '0'}`).join(',');
  const [snap, setSnap] = useState<Snapshot>(() => ({ key, changed: [] }));
  if (snap.key !== key) {
    const before = new Set(snap.key.split(','));
    setSnap({
      key,
      changed: rows
        .filter((r) => !before.has(`${r.id}:${r.done ? '1' : '0'}`))
        .map((r) => ({ id: r.id, text: rowText(r.label, r.done) })),
    });
  }
  useEffect(() => {
    for (const c of snap.changed) announce(c.text);
  }, [snap]);
  const live = new Set(snap.changed.map((c) => c.id));
  return (
    <View style={{ gap: space.s2 }}>
      {rows.map((r) => (
        <View
          key={r.id}
          accessible
          accessibilityLabel={rowText(r.label, r.done)}
          accessibilityLiveRegion={live.has(r.id) ? 'polite' : 'none'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}
        >
          <Icon
            as={r.done ? CircleCheck : Circle}
            size="xs"
            tone={r.done ? 'successFg' : 'textMuted'}
          />
          <Text variant="bodySm" tone={r.done ? 'successFg' : 'textSecondary'}>
            {r.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
