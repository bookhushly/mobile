import type { RefObject } from 'react';
import type { TextInput } from 'react-native';

import type { Guest } from '@/features/customer/domain/checkout/selection';
import { Input, Stack, Text } from '@/shared/ui';

export type GuestErrors = { name?: string; email?: string; phone?: string };
export type GuestRefs = {
  name: RefObject<TextInput | null>;
  email: RefObject<TextInput | null>;
  phone: RefObject<TextInput | null>;
};

type Props = {
  guest: Guest;
  onChange: (g: Guest) => void;
  errors: GuestErrors;
  nameRef: GuestRefs['name'];
  emailRef: GuestRefs['email'];
  phoneRef: GuestRefs['phone'];
  /** Events send a name only for a free registration, so a paid order doesn't ask for it. */
  showName?: boolean;
};

const NAME_MAX = 100;
const EMAIL_MAX = 254;
const PHONE_MAX = 20;

// Spec P16: entered before create (no route edits a booking after it), prefilled from the profile.
export function GuestFields({
  guest,
  onChange,
  errors,
  nameRef,
  emailRef,
  phoneRef,
  showName = true,
}: Props) {
  return (
    <Stack gap="s4" testID="guest-fields">
      <Text variant="headline">Your details</Text>
      {showName ? (
        <Input
          ref={nameRef}
          label="Full name"
          value={guest.name}
          onChangeText={(name) => {
            onChange({ ...guest, name });
          }}
          autoComplete="name"
          textContentType="name"
          maxLength={NAME_MAX}
          error={errors.name}
          testID="guest-name"
        />
      ) : null}
      <Input
        ref={emailRef}
        label="Email"
        value={guest.email}
        onChangeText={(email) => {
          onChange({ ...guest, email });
        }}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={EMAIL_MAX}
        error={errors.email}
        testID="guest-email"
      />
      <Input
        ref={phoneRef}
        label="Phone number"
        value={guest.phone}
        onChangeText={(phone) => {
          onChange({ ...guest, phone });
        }}
        autoComplete="tel"
        textContentType="telephoneNumber"
        keyboardType="phone-pad"
        maxLength={PHONE_MAX}
        error={errors.phone}
        testID="guest-phone"
      />
    </Stack>
  );
}
