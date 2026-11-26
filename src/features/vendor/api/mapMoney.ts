import type { Activity, Earnings } from '@/features/vendor/domain/earnings';

import type { ApiJob, ApiTransaction } from '@/features/vendor/schemas/vendorApi';
import { lagosToday } from '@/shared/lib/lagosDay';

/** Completed payouts, day by day: this month so far and the same days of last month. */
export function monthFrom(txs: readonly ApiTransaction[], nowMs: number): Earnings['month'] {
  const [y = 0, m = 1, d = 1] = lagosToday(nowMs).split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevDays = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  const nowDaily = Array.from({ length: d }, () => 0);
  const thenDaily = Array.from({ length: Math.min(d, prevDays) }, () => 0);
  for (const t of txs) {
    if (t.transaction_type !== 'payout' || t.status !== 'completed') continue;
    const [ty = 0, tm = 0, td = 0] = lagosToday(Date.parse(t.created_at)).split('-').map(Number);
    if (ty === y && tm === m && td <= d) nowDaily[td - 1] = (nowDaily[td - 1] ?? 0) + t.amount;
    else if (ty === prevY && tm === prevM && td <= thenDaily.length)
      thenDaily[td - 1] = (thenDaily[td - 1] ?? 0) + t.amount;
  }
  const cumulative = (xs: number[]) => {
    let sum = 0;
    return xs.map((x) => (sum += x));
  };
  return { now: cumulative(nowDaily), then: cumulative(thenDaily), daysInMonth };
}

const WITHDRAWAL_STATUS: Record<string, Activity['status']> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  rejected: 'failed',
};

export function earningsFrom(i: {
  balance: number;
  jobs: readonly ApiJob[];
  transactions: readonly ApiTransaction[];
  bank: {
    bank_name?: string | null;
    bank_account_name?: string | null;
    account_number_last2?: string | null;
  } | null;
  nowMs: number;
}): Earnings {
  let held = 0;
  let heldJobs = 0;
  for (const j of i.jobs) {
    if (j.status === 'paid' || j.status === 'in_progress' || j.status === 'disputed') {
      held += j.payout_amount ?? 0;
      heldJobs++;
    }
  }
  const activity: Activity[] = [];
  for (const t of i.transactions) {
    if (t.transaction_type === 'payout') {
      activity.push({
        id: t.id,
        kind: 'payout',
        title: t.description?.trim() || 'Job payment',
        at: t.created_at,
        amount: t.amount,
        status: t.status === 'completed' ? 'completed' : 'pending',
      });
    } else if (t.transaction_type === 'withdrawal') {
      const bank = t.metadata?.bank_name ?? 'your bank';
      const last2 = t.metadata?.account_number_last2;
      activity.push({
        id: t.id,
        kind: 'withdrawal',
        title: `To ${bank}${last2 ? ` ••${last2}` : ''}`,
        at: t.created_at,
        amount: t.amount,
        status: WITHDRAWAL_STATUS[t.withdrawal_status ?? ''] ?? 'pending',
      });
    }
  }
  const bankName = i.bank?.bank_name ?? null;
  const last2 = i.bank?.account_number_last2 ?? null;
  return {
    rail: 'wallet',
    month: monthFrom(i.transactions, i.nowMs),
    wallet: { available: i.balance, held, heldJobs },
    bank: bankName !== null && last2 !== null ? { name: bankName, last2 } : null,
    activity,
  };
}
