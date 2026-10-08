import { View } from 'react-native';

import { borderWidth, color } from '@/shared/theme';

export function Divider() {
  return <View style={{ height: borderWidth.hairline, backgroundColor: color.border }} />;
}
