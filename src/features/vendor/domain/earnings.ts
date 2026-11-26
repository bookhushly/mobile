import { formatNaira } from '@/shared/lib/formatNaira';
import { lagosToday, shortDate } from '@/shared/lib/lagosDay';

// Earnings (plan slice 5). Request-for-quote vendors are paid into a Bookhushly wallet and withdraw
// from it; hotels, apartments and events are paid to their bank by Paystack (web RAIL_A).

export type ActivityStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type Activity = {
  id: string;
  /** payout: a job's money into the wallet; withdrawal: out to the bank; bankPayout: Paystack. */
  kind: 'payout' | 'withdrawal' | 'bankPayout';
  title: string;
  at: string;
  /** Naira; withdrawals are shown as money out. */
  amount: number;
  status: ActivityStatus;
};

export type Earnings = {
  rail: 'wallet' | 'bank';
  month: { now: number[]; then: number[]; daysInMonth: number };
  wallet: { available: number; held: number; heldJobs: number } | null;
  /** Where withdrawals go (wallet) or payouts land (bank); null when none is on file. */
  bank: { name: string; last2: string } | null;
  activity: Activity[];
};

/** The web's minimum (`walletService.requestWithdrawalDirect`). */
export const WITHDRAW_MIN = 500;

export function withdrawProblem(raw: string, available: number): string | null {
  if (available < WITHDRAW_MIN) return 'You have nothing to withdraw yet';
  const t = raw.replace(/[,\s]/g, '');
  if (t === '') return 'Enter an amount';
  if (!/^\d+$/.test(t)) return 'Enter a whole amount in naira';
  const n = Number(t);
  if (n < WITHDRAW_MIN) return `The smallest withdrawal is ${formatNaira(WITHDRAW_MIN)}`;
  if (n > available) return `You have ${formatNaira(available)} to withdraw`;
  return null;
}

/** "GTBank ••42": only the last two digits ever reach the app. */
export const bankLabel = (b: { name: string; last2: string }) => `${b.name} ••${b.last2}`;

export function activityLine(a: Activity): string {
  const day = shortDate(lagosToday(Date.parse(a.at)));
  if (a.kind === 'payout') return `${day} · customer confirmed`;
  if (a.kind === 'bankPayout') return `${day} · paid to your bank`;
  switch (a.status) {
    case 'pending':
      return `${day} · being checked by Bookhushly`;
    case 'processing':
      return `${day} · on its way`;
    case 'completed':
      return `${day} · sent`;
    case 'failed':
      return `${day} · didn’t go through, money returned`;
  }
}
