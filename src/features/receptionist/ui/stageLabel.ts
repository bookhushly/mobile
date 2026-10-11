import type { Stage } from '@/features/receptionist/domain/bookingState';
import type { StatusTone } from '@/shared/theme';

export type StageLabel = { label: string; tone: StatusTone };

// Status = word + tone, never colour alone (DESIGN_SYSTEM §10).
const LABELS: Record<Stage, StageLabel> = {
  arriving: { label: 'Arriving', tone: 'info' },
  early: { label: 'Early', tone: 'info' },
  overdue: { label: 'Overdue', tone: 'warning' },
  inHouse: { label: 'In house', tone: 'success' },
  dueOut: { label: 'Due out', tone: 'warning' },
  overdueOut: { label: 'Overdue out', tone: 'danger' },
  unpaid: { label: 'Not paid', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  checkedOut: { label: 'Checked out', tone: 'neutral' },
};

export function stageLabel(stage: Stage): StageLabel {
  return LABELS[stage];
}
