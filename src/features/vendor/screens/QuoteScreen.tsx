import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  parseAmount,
  QUOTE_MESSAGE_MAX,
  QUOTE_OPEN_HOURS,
  quoteBreakdown,
  quoteProblem,
  type RequestDetail,
  type Vehicle,
} from '@/features/vendor/domain/requests';
import type { QuoteInput, QuoteProblem } from '@/features/vendor/hooks/useVendorRequests';
import { ServicePhoto } from '@/features/vendor/ui/ServicePhoto';
import { borderWidth, color, radius, space, vendorSize } from '@/shared/theme';
import {
  Banner,
  Button,
  formatNaira,
  Header,
  IconButton,
  Input,
  ListRow,
  Screen,
  SkeletonRows,
  Text,
} from '@/shared/ui';

type Props = {
  request: RequestDetail;
  vehicles: Vehicle[] | null;
  /** Bookhushly's fee as a fraction; undefined while it loads, null when it can't be known yet. */
  feeRate: number | null | undefined;
  sending: boolean;
  problem: QuoteProblem | null;
  onBack: () => void;
  onSend: (q: QuoteInput) => void;
};

/**
 * Send a quote (design v13, Airtasker's offer): your price, what you keep right under it, the
 * vehicle you'll send, a short message. The server re-checks the amount and the vehicle.
 */
export function QuoteScreen({
  request,
  vehicles,
  feeRate,
  sending,
  problem,
  onBack,
  onSend,
}: Props) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const invalid = quoteProblem(amount, message);
  const n = parseAmount(amount);
  const shown = n !== null && !Number.isNaN(n) && invalid === null ? n : null;
  const split =
    shown !== null && feeRate !== null && feeRate !== undefined
      ? quoteBreakdown(shown, feeRate)
      : null;
  const pickVehicle = vehicles !== null && vehicles.length > 0;
  // With a fleet, the customer should know which vehicle is coming (the web asks the same).
  const vehicleMissing = pickVehicle && vehicleId === null;

  const send = () => {
    setTried(true);
    if (invalid !== null || vehicleMissing || shown === null) return;
    onSend({ amount: shown, message: message.trim(), vehicleId });
  };

  return (
    <Screen
      scroll
      header={
        <Header
          title={request.title}
          left={<IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} />}
        />
      }
      footer={
        <View style={{ gap: space.s3 }}>
          {problem === null ? null : (
            <Banner
              tone={problem.transient ? 'neutral' : 'warning'}
              title={problem.title}
              message={problem.message}
            />
          )}
          {split === null ? null : (
            <Text variant="label" align="center" tabular>
              {`You’ll receive ${formatNaira(split.receive)}`}
            </Text>
          )}
          <Button label="Send quote" loading={sending} onPress={send} testID="vendor-quote-send" />
        </View>
      }
    >
      <View style={{ gap: space.s6, paddingBottom: space.s7 }}>
        <View style={{ gap: space.s2 }}>
          <Text variant="titleLg" accessibilityRole="header">
            Your price
          </Text>
          <Text variant="bodySm" tone="textSecondary">
            The customer sees your price and message, never the other quotes.
          </Text>
        </View>
        <Input
          label="Price in naira"
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          inputMode="numeric"
          left={<Text variant="label">₦</Text>}
          error={
            tried && invalid !== null && invalid !== 'Keep the message under 1,000 characters'
              ? invalid
              : undefined
          }
          testID="vendor-quote-amount"
        />
        <View
          style={{
            borderWidth: borderWidth.hairline,
            borderColor: color.border,
            borderRadius: radius.r4,
            paddingHorizontal: space.s5,
          }}
        >
          {feeRate === undefined ? (
            <SkeletonRows count={2} />
          ) : feeRate === null ? (
            <Text variant="caption" tone="textSecondary" style={{ paddingVertical: space.s4 }}>
              Bookhushly’s fee comes off this price. You’ll see what you receive on the job once the
              customer chooses you.
            </Text>
          ) : (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: space.s4,
                }}
              >
                <Text variant="caption" tone="textSecondary">
                  {`Bookhushly fee (${String(Math.round(feeRate * 100))}%)`}
                </Text>
                <Text variant="caption" tone="textSecondary" tabular>
                  {split === null ? '–' : `−${formatNaira(split.fee)}`}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: space.s4,
                  borderTopWidth: borderWidth.hairline,
                  borderTopColor: color.border,
                }}
              >
                <Text variant="label">You’ll receive</Text>
                <Text variant="label" tabular testID="vendor-quote-receive">
                  {split === null ? '–' : formatNaira(split.receive)}
                </Text>
              </View>
            </>
          )}
        </View>

        {pickVehicle ? (
          <View style={{ gap: space.s3 }}>
            <Text variant="label">Which vehicle?</Text>
            {tried && vehicleMissing ? (
              <Text variant="caption" tone="textPrimary" accessibilityLiveRegion="polite">
                Choose the vehicle you’ll send
              </Text>
            ) : null}
            <View accessibilityRole="radiogroup">
              {vehicles.map((v) => (
                <ListRow
                  key={v.id}
                  title={v.name}
                  subtitle={v.detail}
                  checked={vehicleId === v.id}
                  leading={
                    <View
                      style={{
                        width: vendorSize.rowPhoto,
                        borderRadius: radius.r3,
                        overflow: 'hidden',
                      }}
                    >
                      <ServicePhoto photo={v.photo} height={vendorSize.rowPhoto} />
                    </View>
                  }
                  onPress={() => {
                    setVehicleId(v.id);
                  }}
                  testID={`vendor-vehicle-${v.id}`}
                />
              ))}
            </View>
            <Text variant="caption" tone="textSecondary">
              Add vehicles and drivers on bookhushly.com.
            </Text>
          </View>
        ) : null}

        <Input
          label="Message to the customer (optional)"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={QUOTE_MESSAGE_MAX}
          hint="What’s included, how you’ll handle it"
          testID="vendor-quote-message"
        />
        <Text variant="caption" tone="textSecondary">
          {`Your quote stays open for ${String(QUOTE_OPEN_HOURS)} hours. You can withdraw it until the customer chooses.`}
        </Text>
      </View>
    </Screen>
  );
}
