import { useShiftLog, type ShiftEntry } from '@/features/receptionist/state/shiftLog';

const entry = (at: number, text = `t${String(at)}`): ShiftEntry => ({ at, kind: 'checkIn', text });

beforeEach(() => {
  useShiftLog.getState().clear();
});

it('starts empty and lists the newest entry first', () => {
  expect(useShiftLog.getState().entries).toEqual([]);
  useShiftLog.getState().add(entry(1));
  useShiftLog.getState().add(entry(2));
  expect(useShiftLog.getState().entries.map((e) => e.at)).toEqual([2, 1]);
});

it('keeps at most 200 entries, dropping the oldest', () => {
  for (let i = 1; i <= 205; i += 1) useShiftLog.getState().add(entry(i));
  const { entries } = useShiftLog.getState();
  expect(entries).toHaveLength(200);
  expect(entries[0]?.at).toBe(205);
  expect(entries[199]?.at).toBe(6);
});

it('clear() empties the log', () => {
  useShiftLog.getState().add(entry(1));
  useShiftLog.getState().clear();
  expect(useShiftLog.getState().entries).toEqual([]);
});
