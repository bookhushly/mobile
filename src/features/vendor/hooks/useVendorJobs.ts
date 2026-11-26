import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { vendorSource } from '@/features/vendor/api/vendorSource';
import type { Milestone } from '@/features/vendor/domain/jobs';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import { vendorKeys } from '@/features/vendor/hooks/useVendor';
import { VendorError } from '@/features/vendor/hooks/useVendorRequests';
import { otherRefusal, vendorRetry } from '@/features/vendor/hooks/vendorErrors';
import { clock } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Who = { vendorId: string; kind: ServedKind };

async function unwrap<T>(p: Promise<Result<T, ApiError>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new VendorError(r.error);
  return r.value;
}

export function useVendorJobs({ vendorId, kind }: Who) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.jobs(vendorId),
    queryFn: () => unwrap(vendorSource.jobs(kind, clock.serverNow())),
  });
}

export function useVendorJob({ vendorId, kind }: Who, id: string) {
  return useQuery({
    retry: vendorRetry,
    queryKey: vendorKeys.job(vendorId, id),
    queryFn: () => unwrap(vendorSource.job(kind, id, clock.serverNow())),
  });
}

export type JobAction =
  | { kind: 'start' }
  | { kind: 'milestone'; milestone: Milestone; photoUri: string | null }
  | { kind: 'complete' };

/**
 * Move a job on. Each step is a compare-and-set on the server (web spec §7, §9): a retry after a
 * lost response comes back as "wrong status", and the refresh below shows where it really stands.
 */
export function useJobAction({ vendorId, kind }: Who, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: JobAction) => {
      const now = clock.serverNow();
      switch (a.kind) {
        case 'start':
          return unwrap(vendorSource.startJob(kind, id, now));
        case 'milestone':
          return unwrap(vendorSource.milestone(kind, id, a.milestone, a.photoUri, now));
        case 'complete':
          return unwrap(vendorSource.completeJob(kind, id, now));
      }
    },
    onSuccess: (job) => {
      qc.setQueryData(vendorKeys.job(vendorId, id), job);
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: vendorKeys.jobs(vendorId) }),
        qc.invalidateQueries({ queryKey: vendorKeys.today(vendorId) }),
      ]),
  });
}

export type JobProblem = { title: string; message: string; transient: boolean };

/** In words for the vendor. A transient failure is never a refusal (CLAUDE.md). */
export function jobErrorWords(e: unknown): JobProblem {
  const a = e instanceof VendorError ? e.apiError : null;
  if (a?.kind === 'conflict' && a.code === 'photo_required')
    return {
      title: 'Add a delivery photo',
      message: 'A photo of the delivered items is needed before the job is done.',
      transient: false,
    };
  if (a?.kind === 'conflict')
    return {
      title: 'This job has already moved on',
      message: 'We’ve refreshed it so you can see where it stands.',
      transient: false,
    };
  if (a?.kind === 'forbidden')
    return {
      title: 'Your account can’t update jobs right now',
      message: 'Open bookhushly.com to see why.',
      transient: false,
    };
  const other = otherRefusal(a);
  if (other !== null) return other;
  return {
    title: 'We couldn’t reach Bookhushly',
    message: 'We couldn’t confirm it went through. Try again.',
    transient: true,
  };
}
