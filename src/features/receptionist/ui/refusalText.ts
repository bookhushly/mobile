import type { DeskAct, Refusal } from '@/features/receptionist/domain/deskOutcome';
import { CANCELLED_TEXT, UNPAID_TEXT } from '@/features/receptionist/ui/warningText';
import { lagosTime, lagosWhen, type IsoDate } from '@/shared/lib/lagosDay';
import type { StatusTone } from '@/shared/theme';

export type RefusalCopy = {
  message: string;
  /** Refusals are warning or danger: never the neutral tone transient failures use (spec §4). */
  tone: Exclude<StatusTone, 'neutral' | 'info' | 'success'>;
  /** Offer **Choose another room** (R9). */
  chooseRoom: boolean;
};

// `roomNumber`: the room the desk is looking at, used when the server's refusal names none.
// `today`: the desk's Lagos day; a check-in time on another day is said with its date.
type Ctx = { act?: DeskAct; roomNumber?: number; today?: IsoDate };

// Without the desk's day, the time alone.
function whenText(iso: string, today: IsoDate | undefined): string {
  if (today !== undefined) return lagosWhen(iso, today);
  const t = lagosTime(iso);
  return t === '' ? '' : `at ${t}`;
}

const roomWord = (n: number | null) => (n === null ? 'The room' : `Room ${String(n)}`);

export function refusalText(r: Refusal, ctx: Ctx = {}): RefusalCopy {
  const act = ctx.act ?? 'checkIn';
  const say = (message: string, tone: RefusalCopy['tone'], chooseRoom = false): RefusalCopy => ({
    message,
    tone,
    chooseRoom,
  });
  switch (r.kind) {
    case 'cancelled':
      return say(CANCELLED_TEXT, 'danger');
    case 'unpaid':
      return say(UNPAID_TEXT, 'warning');
    case 'alreadyIn': {
      const when = r.at === null ? '' : whenText(r.at, ctx.today);
      return say(when === '' ? 'Already checked in.' : `Already checked in ${when}.`, 'warning');
    }
    case 'alreadyOut':
      return say('This guest has already checked out.', 'warning');
    case 'notCheckedIn':
      return say("This guest isn't checked in.", 'warning');
    case 'roomOccupied':
      return say(
        `${roomWord(r.roomNumber ?? ctx.roomNumber ?? null)} still has a guest checked in.`,
        'warning',
        true,
      );
    case 'roomUnavailable': {
      const room = roomWord(r.roomNumber ?? ctx.roomNumber ?? null);
      const why =
        r.roomStatus === 'under_maintenance'
          ? `${room} is under maintenance.`
          : r.roomStatus === 'out_of_service'
            ? `${room} is out of service.`
            : `${room} isn't available.`;
      return say(why, 'warning', true);
    }
    case 'roomTaken':
      return say(
        ctx.roomNumber === undefined
          ? 'That room was just taken. Choose another.'
          : `Room ${String(ctx.roomNumber)} was just taken. Choose another.`,
        'warning',
      );
    case 'forbidden':
      return say(
        act === 'reassign' || act === 'roomStatus'
          ? "You can't change rooms at this hotel."
          : act === 'checkOut'
            ? "You can't check out guests at this hotel."
            : "You can't check in guests at this hotel.",
        'danger',
      );
    case 'notFound':
      return say(
        act === 'roomStatus'
          ? 'This room no longer exists.'
          : act === 'reassign'
            ? 'This booking or room no longer exists.'
            : 'This booking no longer exists.',
        'danger',
      );
    case 'invalid': {
      const verb =
        act === 'reassign'
          ? 'move this booking'
          : act === 'checkOut'
            ? 'check out this booking'
            : act === 'roomStatus'
              ? 'change this room'
              : 'check in this booking';
      return say(`Couldn't ${verb}. Try again or use the web dashboard.`, 'warning');
    }
  }
}
