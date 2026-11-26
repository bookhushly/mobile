import { earningsFrom } from '@/features/vendor/api/mapVendor';
import type { Activity, Earnings } from '@/features/vendor/domain/earnings';

import {
  bankBody,
  transactionsBody,
  walletBody,
  withdrawBody,
  type ApiJob,
} from '@/features/vendor/schemas/vendorApi';

import { ok } from '@/shared/lib/result';
import type { R, Requester } from '@/features/vendor/api/vendorHttpCommon';

/** The wallet: balance, what's held, activity, the bank on file, and withdrawing. */
export function createMoneyHttp(c: Requester, jobsRaw: () => R<ApiJob[]>) {
  const transactions = () =>
    c.request('/api/wallet/transactions?limit=100', { schema: transactionsBody });

  async function earnings(nowMs: number): R<Earnings> {
    const [w, j, t, b] = await Promise.all([
      c.request('/api/wallet', { schema: walletBody }),
      jobsRaw(),
      transactions(),
      c.request('/api/vendor/bank-details', { schema: bankBody }),
    ]);
    if (!w.ok) return w;
    if (!j.ok) return j;
    if (!t.ok) return t;
    // No bank on file reads as null fields, not an error; a failed read must not hide the money.
    const bank = b.ok ? b.value.data : null;
    return ok(
      earningsFrom({
        balance: w.value.data.balance,
        jobs: j.value,
        transactions: t.value.data,
        bank,
        nowMs,
      }),
    );
  }

  return {
    earnings,
    async withdraw(amount: number, idempotencyKey: string): R<Activity> {
      const r = await c.request('/api/wallet/withdraw', {
        method: 'POST',
        body: { amount, idempotency_key: idempotencyKey },
        schema: withdrawBody,
        // The key is stored: a retry after a timeout or 503 can never debit twice.
        idempotent: true,
      });
      if (!r.ok) return r;
      const w = r.value.withdrawal;
      return ok({
        id: w.id,
        kind: 'withdrawal',
        title: 'To your bank',
        at: new Date().toISOString(),
        amount: w.amount,
        status: WITHDRAWAL_STATUS[w.status] ?? 'pending',
      });
    },
  };
}

const WITHDRAWAL_STATUS: Record<string, Activity['status']> = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  rejected: 'failed',
};
