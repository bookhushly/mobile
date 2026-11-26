import {
  quoteErrorWords,
  useVendorRequest,
  useWithdrawQuote,
  VendorError,
} from '@/features/vendor/hooks/useVendorRequests';

import { RequestScreen } from '@/features/vendor/screens/RequestScreen';

import { clock } from '@/shared/api/instance';

import { useWho } from '@/features/vendor/hooks/useVendorScreen';

type RequestNav = { id: string; onBack: () => void; onQuote: () => void; onOpenJobs: () => void };

export function VendorRequest({ id, onBack, onQuote, onOpenJobs }: RequestNav) {
  const who = useWho();
  const q = useVendorRequest(who, id);
  const withdraw = useWithdrawQuote(who, id);
  return (
    <RequestScreen
      nowMs={clock.serverNow()}
      onBack={onBack}
      onQuote={onQuote}
      onOpenJobs={onOpenJobs}
      withdraw={{
        busy: withdraw.isPending,
        problem: withdraw.isError ? quoteErrorWords(withdraw.error) : null,
        run: async () => {
          try {
            await withdraw.mutateAsync();
            return true;
          } catch {
            return false;
          }
        },
      }}
      state={
        q.isPending
          ? { status: 'loading' }
          : q.isError
            ? {
                status: 'error',
                notFound: q.error instanceof VendorError && q.error.kind === 'notFound',
                retry: () => void q.refetch(),
              }
            : { status: 'ready', request: q.data }
      }
    />
  );
}
