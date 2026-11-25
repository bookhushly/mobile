import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Banner } from '@/shared/ui';

type Props = {
  problem: string | null;
  /** The cancel sheet shows its own problem while it's open. */
  cancelling: boolean;
  notice: string | null;
  onDismissNotice: () => void;
  children: ReactNode;
};

/** A request screen's footer: a problem or a notice above the stage's own action. */
export function RequestFooter({ problem, cancelling, notice, onDismissNotice, children }: Props) {
  return (
    <View style={{ gap: space.s3 }}>
      {problem === null || cancelling ? null : <Banner tone="neutral" message={problem} />}
      {notice === null ? null : (
        <Banner tone="neutral" message={notice} onDismiss={onDismissNotice} testID="car-notice" />
      )}
      {children}
    </View>
  );
}
