import {
  quoteErrorWords,
  useQuoteSetup,
  useSendQuote,
  useVendorRequest,
} from '@/features/vendor/hooks/useVendorRequests';
import { QuoteScreen } from '@/features/vendor/screens/QuoteScreen';

import { Screen, SkeletonRows } from '@/shared/ui';
import { useWho } from '@/features/vendor/hooks/useVendorScreen';

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
