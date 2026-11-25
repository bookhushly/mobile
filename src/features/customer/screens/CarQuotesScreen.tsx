import { QuotesScreen } from '@/features/customer/screens/QuotesScreen';
import { CAR_TERMS } from '@/features/customer/ui/car/quoteTerms';

type Props = {
  userId: string;
  id: string;
  onBack: () => void;
  onOpenQuote: (offerId: string) => void;
};

/** Car rental quotes (design 3A). */
export function CarQuotesScreen(p: Props) {
  return <QuotesScreen terms={CAR_TERMS} {...p} />;
}
