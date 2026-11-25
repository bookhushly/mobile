import { QuoteScreen } from '@/features/customer/screens/QuoteScreen';
import { CAR_TERMS } from '@/features/customer/ui/car/quoteTerms';

type Props = {
  userId: string;
  id: string;
  offerId: string;
  onBack: () => void;
  /** Chosen: on to the request, which opens the checkout. */
  onChosen: () => void;
};

/** One car rental quote (design 3A). */
export function CarQuoteScreen(p: Props) {
  return <QuoteScreen terms={CAR_TERMS} {...p} />;
}
