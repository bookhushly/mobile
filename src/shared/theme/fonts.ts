import { Platform } from 'react-native';
import type { FontKind } from './type';

type Weight = 400 | 500 | 600;

// Android: family name = file name without .ttf. iOS: PostScript name read from the file.
const android = {
  sans: {
    400: 'HankenGrotesk_400Regular',
    500: 'HankenGrotesk_500Medium',
    600: 'HankenGrotesk_600SemiBold',
  },
} as const;

const ios = {
  sans: {
    400: 'HankenGrotesk-Regular',
    500: 'HankenGrotesk-Medium',
    600: 'HankenGrotesk-SemiBold',
  },
} as const;

export function fontFamily(kind: FontKind, weight: Weight): string {
  const table = Platform.OS === 'ios' ? ios : android;
  return table[kind][weight];
}
