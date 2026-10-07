import type { DbRes } from '@/shared/lib/dbError';

type Builder = PromiseLike<{ data: unknown; error: { code?: string } | null; status: number }>;

export const wrap = async (b: Builder): Promise<DbRes> => {
  const r = await b;
  return { data: r.data, error: r.error ? { code: r.error.code, status: r.status } : null };
};
