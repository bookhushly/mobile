import { useState } from 'react';
import { FlatList, View } from 'react-native';

import type { ProfileInput } from '@/features/customer/api/customerDb';
import type { WriteOutcome } from '@/features/customer/hooks/sessionWrite';
import type { ProfileRow } from '@/features/customer/schemas/profile';
import { formatNigerianPhone, NIGERIAN_STATES, parseNigerianPhone } from '@/shared/lib/phone';
import { space } from '@/shared/theme';
import { Banner, Button, Input, ListRow, SearchField, Sheet } from '@/shared/ui';

export type ProfileField = 'name' | 'phone' | 'state' | 'address';

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const ADDRESS_MAX = 200;

const TITLE: Record<ProfileField, string> = {
  name: 'Name',
  phone: 'Phone number',
  state: 'State',
  address: 'Address',
};
const NAME_ERROR = `Enter your name (${String(NAME_MIN)} to ${String(NAME_MAX)} characters)`;
const PHONE_ERROR = 'Enter a Nigerian number, like 0803 123 4567';
const TRANSIENT = 'Couldn’t save. Check your connection and try again.';
const STALE = 'Couldn’t save: your session has expired.';

type Props = {
  field: ProfileField;
  profile: ProfileRow;
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (p: ProfileInput) => Promise<WriteOutcome>;
  /** A stale session: sign out so the user can sign in again (the route's sign-out). */
  onSignIn: () => void;
};

function nameError(v: string): string | undefined {
  const n = v.trim().length;
  return n < NAME_MIN || n > NAME_MAX ? NAME_ERROR : undefined;
}

function phoneError(v: string): string | undefined {
  return v.trim() === '' || parseNigerianPhone(v).ok ? undefined : PHONE_ERROR;
}

/**
 * C14: one small edit sheet per detail. The parent keys it per open, so the draft starts from the
 * saved value each time. A failed save keeps what was typed (DESIGN_SYSTEM: preserve input).
 */
export function ProfileFieldSheet({
  field,
  profile,
  visible,
  saving,
  onClose,
  onSave,
  onSignIn,
}: Props) {
  const [text, setText] = useState(() => {
    if (field === 'name') return profile.name;
    if (field === 'phone') return profile.phone === null ? '' : formatNigerianPhone(profile.phone);
    if (field === 'address') return profile.address ?? '';
    return '';
  });
  const [state, setState] = useState<string | null>(profile.state);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [outcome, setOutcome] = useState<WriteOutcome | null>(null);

  const edit = (v: string) => {
    setText(v);
    setError(undefined);
  };

  const submit = async () => {
    const base: ProfileInput = {
      name: profile.name,
      phone: profile.phone,
      state: profile.state,
      address: profile.address,
    };
    let next: ProfileInput;
    if (field === 'name') {
      const e = nameError(text);
      if (e !== undefined) {
        setError(e);
        return;
      }
      next = { ...base, name: text.trim() };
    } else if (field === 'phone') {
      if (text.trim() === '') next = { ...base, phone: null };
      else {
        const p = parseNigerianPhone(text);
        if (!p.ok) {
          setError(PHONE_ERROR);
          return;
        }
        next = { ...base, phone: p.e164 };
      }
    } else if (field === 'address') {
      const a = text.trim();
      next = { ...base, address: a === '' ? null : a.slice(0, ADDRESS_MAX) };
    } else {
      next = { ...base, state };
    }
    setOutcome(null);
    const r = await onSave(next);
    if (r === 'ok') onClose();
    else setOutcome(r);
  };

  const states =
    query.trim() === ''
      ? NIGERIAN_STATES
      : NIGERIAN_STATES.filter((s) => s.toLowerCase().includes(query.trim().toLowerCase()));

  let body;
  if (field === 'state')
    body = (
      <>
        <SearchField label="Search states" value={query} onChangeText={setQuery} />
        <View accessibilityRole="radiogroup" style={{ flex: 1 }}>
          <FlatList
            data={states}
            keyExtractor={(s) => s}
            keyboardShouldPersistTaps="handled"
            // 37 short rows: render them all, so the checked one is there to see (and to find).
            initialNumToRender={NIGERIAN_STATES.length}
            renderItem={({ item }) => (
              <ListRow
                title={item}
                checked={item === state}
                onPress={() => {
                  setState(item);
                }}
              />
            )}
          />
        </View>
      </>
    );
  else if (field === 'name')
    body = (
      <Input
        label="Full name"
        value={text}
        onChangeText={edit}
        onBlur={() => {
          setError(nameError(text));
        }}
        error={error}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
    );
  else if (field === 'phone')
    body = (
      <Input
        label="Phone number"
        value={text}
        onChangeText={edit}
        onBlur={() => {
          const e = phoneError(text);
          setError(e);
          const p = parseNigerianPhone(text);
          if (e === undefined && p.ok) setText(formatNigerianPhone(p.e164));
        }}
        error={error}
        hint="Leave it empty to remove your number"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
    );
  else
    body = (
      <Input
        label="Address"
        value={text}
        onChangeText={edit}
        multiline
        maxLength={ADDRESS_MAX}
        hint={`${String(text.length)} of ${String(ADDRESS_MAX)} characters`}
        autoComplete="street-address"
        style={{ textAlignVertical: 'top', paddingVertical: space.s3 }}
      />
    );

  return (
    <Sheet
      visible={visible}
      title={TITLE[field]}
      onClose={onClose}
      closeLabel="Cancel"
      closeDisabled={saving}
      // Text fields scroll (large Dynamic Type + hint + error + banner under the keyboard). The
      // state picker has its own FlatList, which must not nest inside the Sheet's ScrollView.
      scroll={field !== 'state'}
      footer={
        <Button
          label="Save"
          loading={saving}
          disabled={saving}
          onPress={() => {
            void submit();
          }}
        />
      }
    >
      {outcome !== null ? (
        outcome === 'stale' ? (
          <Banner
            tone="neutral"
            message={STALE}
            action={{ label: 'Sign in again', onPress: onSignIn }}
          />
        ) : (
          <Banner tone="neutral" message={TRANSIENT} />
        )
      ) : null}
      {body}
    </Sheet>
  );
}
