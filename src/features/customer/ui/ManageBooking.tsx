import {
  ChevronRight,
  CircleCheck,
  CircleX,
  Send,
  Star,
  Undo2,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { BookingAction } from '@/features/customer/domain/bookingActions';
import { borderWidth, color, space, type ColorRole } from '@/shared/theme';
import { Icon, SectionHeader, Text, useDensity } from '@/shared/ui';

type Props = {
  /** Already filtered and ordered (transfer, refund, review, cancel). */
  actions: readonly BookingAction[];
  /** A refund request was sent from this device (or the server said one exists). */
  refundRequested: boolean;
  reviewed: boolean;
  onOpen: (action: BookingAction) => void;
};

const ROW: Record<BookingAction, { label: string; icon: LucideIcon; tone: ColorRole }> = {
  transfer: { label: 'Transfer tickets', icon: Send, tone: 'textPrimary' },
  refund: { label: 'Ask for a refund', icon: Undo2, tone: 'textPrimary' },
  review: { label: 'Write a review', icon: Star, tone: 'textPrimary' },
  cancel: { label: 'Cancel booking', icon: CircleX, tone: 'dangerFg' },
};

const DONE: Partial<Record<BookingAction, string>> = {
  refund: 'Refund requested',
  review: 'Reviewed',
};

// Spec E9: one place to act — only the available actions, Cancel last in the danger tone.
export function ManageBooking({ actions, refundRequested, reviewed, onOpen }: Props) {
  const d = useDensity();
  if (actions.length === 0) return null;
  const line = {
    minHeight: d.rowMin,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.s4,
    paddingVertical: space.s3,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: color.border,
  };
  return (
    <View testID="manage-booking">
      <SectionHeader label="Manage booking" />
      {actions.map((a) => {
        const done =
          (a === 'refund' && refundRequested) || (a === 'review' && reviewed) ? DONE[a] : null;
        if (done !== null && done !== undefined)
          return (
            <View key={a} accessible accessibilityLabel={done} style={line}>
              <Icon as={CircleCheck} size="sm" tone="successFg" />
              <Text variant="body" tone="textSecondary" style={{ flex: 1 }}>
                {done}
              </Text>
            </View>
          );
        const r = ROW[a];
        return (
          <Pressable
            key={a}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            onPress={() => {
              onOpen(a);
            }}
            style={({ pressed }) => [line, { backgroundColor: pressed ? color.wash : undefined }]}
          >
            <Icon as={r.icon} size="sm" tone={r.tone} />
            <Text variant="bodyStrong" tone={r.tone} style={{ flex: 1 }}>
              {r.label}
            </Text>
            <Icon as={ChevronRight} size="sm" tone="textSecondary" />
          </Pressable>
        );
      })}
    </View>
  );
}
