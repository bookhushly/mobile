import type { QuoteProblem } from '@/features/vendor/hooks/useVendorRequests';
import { Banner, Button, Sheet, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  /** Still taking quotes: the vendor can send a new one after withdrawing. */
  open: boolean;
  busy: boolean;
  problem: QuoteProblem | null;
  onClose: () => void;
  onConfirm: () => void;
};

/** "Withdraw your quote?", with a failure shown here, where the vendor is looking. */
export function WithdrawQuoteSheet({ visible, open, busy, problem, onClose, onConfirm }: Props) {
  return (
    <Sheet
      visible={visible}
      title="Withdraw your quote?"
      onClose={onClose}
      footer={
        <Button
          label="Withdraw quote"
          variant="destructive"
          loading={busy}
          onPress={onConfirm}
          testID="vendor-withdraw-confirm"
        />
      }
    >
      {problem === null ? null : (
        <Banner
          tone={problem.transient ? 'neutral' : 'warning'}
          title={problem.title}
          message={problem.message}
        />
      )}
      <Text variant="body" tone="textSecondary">
        {open
          ? 'The customer won’t see it any more. You can send a new quote while the request is open.'
          : 'The customer won’t see it any more.'}
      </Text>
    </Sheet>
  );
}
