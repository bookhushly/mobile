import { CharCounter } from '@/features/customer/ui/CharCounter';
import { Input, Stack } from '@/shared/ui';

const REQUESTS_MAX = 1000;

type Props = { value: string; onChange: (text: string) => void };

// Hotels: free text for the hotel, at most 1000 characters (the create route's limit).
export function SpecialRequests({ value, onChange }: Props) {
  return (
    <Stack gap="s2">
      <Input
        label="Special requests (optional)"
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={REQUESTS_MAX}
        testID="special-requests"
      />
      <CharCounter length={value.length} max={REQUESTS_MAX} />
    </Stack>
  );
}
