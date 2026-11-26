import { sampleToday } from '@/features/vendor/api/sampleToday';
import type { Activity, Earnings } from '@/features/vendor/domain/earnings';
import { isQuoteKind, type ServedKind } from '@/features/vendor/domain/vendorProfile';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

// SAMPLE DATA (vendor mode is dev-only until the web vendor routes ship). A withdrawal made in this
// session moves money out of "to withdraw" and shows as "being checked", as the web's will.

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

const madeHere: Activity[] = [];
let withdrawnHere = 0;

function walletActivity(nowMs: number): Activity[] {
  return [
    {
      id: 'a1',
      kind: 'payout',
      title: 'Fridge to Ikorodu',
      at: iso(nowMs - 3 * DAY),
      amount: 25_200,
      status: 'completed',
    },
    {
      id: 'a2',
      kind: 'withdrawal',
      title: 'To GTBank ••42',
      at: iso(nowMs - 5 * DAY),
      amount: 150_000,
      status: 'completed',
    },
    {
      id: 'a3',
      kind: 'payout',
      title: 'Office move, Ikoyi',
      at: iso(nowMs - 6 * DAY),
      amount: 120_000,
      status: 'completed',
    },
    {
      id: 'a4',
      kind: 'payout',
      title: 'Parcel to Lekki',
      at: iso(nowMs - 9 * DAY),
      amount: 18_000,
      status: 'completed',
    },
  ];
}

function bankActivity(nowMs: number): Activity[] {
  return [
    {
      id: 'b1',
      kind: 'bankPayout',
      title: 'Bookings, 3 nights',
      at: iso(nowMs - DAY),
      amount: 186_000,
      status: 'completed',
    },
    {
      id: 'b2',
      kind: 'bankPayout',
      title: 'Bookings, 2 nights',
      at: iso(nowMs - 4 * DAY),
      amount: 124_000,
      status: 'completed',
    },
  ];
}

export function sampleEarnings(kind: ServedKind, nowMs: number): Earnings {
  const month = sampleToday(kind, nowMs).month;
  if (!isQuoteKind(kind))
    return {
      rail: 'bank',
      month,
      wallet: null,
      bank: { name: 'Access Bank', last2: '17' },
      activity: bankActivity(nowMs),
    };
  const w = sampleToday(kind, nowMs).wallet;
  return {
    rail: 'wallet',
    month,
    wallet: { ...w, available: w.available - withdrawnHere },
    bank: { name: 'GTBank', last2: '42' },
    activity: [...madeHere, ...walletActivity(nowMs)],
  };
}

export function sampleWithdraw(
  kind: ServedKind,
  amount: number,
  nowMs: number,
): Result<Activity, ApiError> {
  const e = sampleEarnings(kind, nowMs);
  if (e.wallet === null || e.bank === null)
    return err({ kind: 'conflict', code: 'no_bank_account' });
  if (amount > e.wallet.available) return err({ kind: 'conflict', code: 'insufficient_balance' });
  const a: Activity = {
    id: `w-${String(madeHere.length + 1)}`,
    kind: 'withdrawal',
    title: `To ${e.bank.name} ••${e.bank.last2}`,
    at: iso(nowMs),
    amount,
    status: 'pending',
  };
  madeHere.unshift(a);
  withdrawnHere += amount;
  return ok(a);
}
