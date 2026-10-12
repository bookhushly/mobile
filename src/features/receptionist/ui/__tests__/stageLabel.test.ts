import type { Stage } from '@/features/receptionist/domain/bookingState';
import { stageLabel } from '@/features/receptionist/ui/stageLabel';
import { blockerText, warningText } from '@/features/receptionist/ui/warningText';

it.each<[Stage, string, string]>([
  ['arriving', 'Arriving', 'info'],
  ['early', 'Early', 'info'],
  ['overdue', 'Overdue', 'warning'],
  ['inHouse', 'In house', 'success'],
  ['dueOut', 'Due out', 'warning'],
  ['overdueOut', 'Overdue out', 'danger'],
  ['unpaid', 'Not paid', 'warning'],
  ['cancelled', 'Cancelled', 'neutral'],
  ['checkedOut', 'Checked out', 'neutral'],
])('%s reads "%s" in the %s tone', (stage, label, tone) => {
  expect(stageLabel(stage)).toEqual({ label, tone });
});

it('words each warning with the date and the number of days', () => {
  expect(warningText({ kind: 'earlyArrival', days: 2, date: '2026-10-14' })).toBe(
    'Booked for Wed 14 Oct — 2 days early. You can still check them in.',
  );
  expect(warningText({ kind: 'earlyArrival', days: 1, date: '2026-10-12' })).toBe(
    'Booked for Mon 12 Oct — 1 day early. You can still check them in.',
  );
  expect(warningText({ kind: 'earlyCheckOut', days: 3, date: '2026-10-14' })).toBe(
    'Booked until Wed 14 Oct — leaving 3 days early.',
  );
  expect(warningText({ kind: 'roomNotReady', roomNumber: 204, status: 'under_maintenance' })).toBe(
    'Room 204 is marked under maintenance. Choose another room or check with housekeeping.',
  );
  expect(warningText({ kind: 'roomNotReady', roomNumber: 7, status: 'out_of_service' })).toBe(
    'Room 7 is marked out of service. Choose another room or check with housekeeping.',
  );
});

it('words each blocker, with the Lagos check-out time when known', () => {
  const today = '2026-10-11';
  expect(blockerText({ kind: 'cancelled' }, today)).toEqual({
    message: 'This booking was cancelled.',
    tone: 'danger',
  });
  expect(blockerText({ kind: 'unpaid' }, today).message).toBe(
    "Payment hasn't been completed for this booking. The guest can pay on the Bookhushly app or website.",
  );
  expect(blockerText({ kind: 'checkedOut', at: '2026-10-11T09:42:00Z' }, today)).toEqual({
    message: 'This guest checked out at 10:42.',
    tone: 'neutral',
  });
  // Not today: the date comes with the time.
  expect(blockerText({ kind: 'checkedOut', at: '2026-10-10T09:42:00Z' }, today).message).toBe(
    'This guest checked out on Sat 10 Oct at 10:42.',
  );
  expect(blockerText({ kind: 'checkedOut', at: null }, today).message).toBe(
    'This guest has checked out.',
  );
});
