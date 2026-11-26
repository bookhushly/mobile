import { useState } from 'react';

import type { RequestTab, VendorRequest as RequestItem } from '@/features/vendor/domain/requests';
import { useVendorSession } from '@/features/vendor/hooks/VendorContext';
import {
  quoteErrorWords,
  useQuoteSetup,
  useSendQuote,
  useVendorRequest,
  useVendorRequests,
  useWithdrawQuote,
  VendorError,
} from '@/features/vendor/hooks/useVendorRequests';
import { QuoteScreen } from '@/features/vendor/screens/QuoteScreen';
import { RequestScreen } from '@/features/vendor/screens/RequestScreen';
import { RequestsScreen } from '@/features/vendor/screens/RequestsScreen';
import { clock } from '@/shared/api/instance';
import { Screen, SkeletonRows } from '@/shared/ui';

// Containers: wire the vendor's data to the pure screens. Navigation comes in from the routes.

function useWho() {
  const { vendor } = useVendorSession();
  return { vendorId: vendor.id, kind: vendor.kind };
}

export function VendorRequests({ onOpen }: { onOpen: (r: RequestItem) => void }) {
  const q = useVendorRequests(useWho());
  const [tab, setTab] = useState<RequestTab>('new');
  const [refreshing, setRefreshing] = useState(false);
  return (
    <RequestsScreen
      nowMs={clock.serverNow()}
      tab={tab}
      onTab={setTab}
      onOpen={onOpen}
      state={
        q.isPending
          ? { status: 'loading' }
          : q.isError
            ? { status: 'error', retry: () => void q.refetch() }
            : {
                status: 'ready',
                requests: q.data,
                refreshing,
                refresh: () => {
                  setRefreshing(true);
                  void q.refetch().finally(() => {
                    setRefreshing(false);
                  });
                },
              }
      }
    />
  );
}

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

export function VendorQuote({
  id,
  onBack,
  onSent,
}: {
  id: string;
  onBack: () => void;
  onSent: () => void;
}) {
  const who = useWho();
  const q = useVendorRequest(who, id);
  const { vehicles, feeRate } = useQuoteSetup(who);
  const send = useSendQuote(who, id);
  if (q.data === undefined)
    return (
      <Screen>
        <SkeletonRows count={5} />
      </Screen>
    );
  return (
    <QuoteScreen
      request={q.data}
      vehicles={vehicles.data ?? null}
      feeRate={feeRate.isPending ? undefined : (feeRate.data ?? null)}
      sending={send.isPending}
      problem={send.isError ? quoteErrorWords(send.error) : null}
      onBack={onBack}
      onSend={(input) => {
        if (send.isPending) return;
        send.mutate(input, { onSuccess: onSent });
      }}
    />
  );
}
