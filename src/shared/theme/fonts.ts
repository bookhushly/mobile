import { Platform } from 'react-native';
import type { FontKind } from './type';

type Weight = 400 | 500 | 600;

// Android: family name = file name without .ttf. iOS: PostScript name read from the file.
const android = {
  sans: {
    400: 'RadioCanada_400Regular',
    500: 'RadioCanada_500Medium',
    600: 'RadioCanada_600SemiBold',
  },
  serif: {
    400: 'SourceSerif4_500Medium',
    500: 'SourceSerif4_500Medium',
    600: 'SourceSerif4_500Medium',
  },
} as const;

const ios = {
  sans: { 400: 'RadioCanada-Regular', 500: 'RadioCanada-Medium', 600: 'RadioCanada-SemiBold' },
  serif: { 400: 'SourceSerif4-Medium', 500: 'SourceSerif4-Medium', 600: 'SourceSerif4-Medium' },
} as const;

export function fontFamily(kind: FontKind, weight: Weight): string {
  const table = Platform.OS === 'ios' ? ios : android;
  return table[kind][weight];
}
