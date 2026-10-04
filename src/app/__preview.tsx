import { Redirect } from 'expo-router';
import { useState } from 'react';

import { color, palette, typeVariants, type Variant } from '@/shared/theme';
import { Box, Button, Card, Input, Money, Screen, Stack, Text } from '@/shared/ui';

const variants = Object.keys(typeVariants) as Variant[];
const swatches = Object.entries(palette);

export default function Preview() {
  const [text, setText] = useState('');
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen scroll>
      <Text variant="displaySm">Bookhushly design check</Text>
      <Text variant="body" tone="textSecondary">
        Ẹ kú àbọ̀ — ọ̀ṣọ́ ṣị ụ · ₦1,234,567
      </Text>
      <Card>
        <Stack gap="s3">
          {variants.map((v) => (
            <Text key={v} variant={v} numberOfLines={1}>
              {v} — Ẹ kú ọ̀nà ₦12,345
            </Text>
          ))}
        </Stack>
      </Card>
      <Card>
        <Stack gap="s2">
          <Money amount={1111} variant="numXl" />
          <Money amount={8888} variant="numXl" />
        </Stack>
      </Card>
      <Stack gap="s3">
        <Button label="Primary action" onPress={() => undefined} />
        <Button label="Secondary action" variant="secondary" onPress={() => undefined} />
        <Button label="Loading" loading onPress={() => undefined} />
        <Input label="Email" value={text} onChangeText={setText} error="Enter a valid email address" />
      </Stack>
      <Stack gap="s2">
        {swatches.map(([name, hex]) => (
          <Box key={name} p="s3" rounded="r2" style={{ backgroundColor: hex }}>
            <Text variant="labelSm" style={{ color: color.textPrimary, backgroundColor: color.surface }}>
              {name} {hex}
            </Text>
          </Box>
        ))}
      </Stack>
    </Screen>
  );
}
