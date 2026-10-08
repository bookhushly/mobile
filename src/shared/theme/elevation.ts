import { Platform, type ViewStyle } from 'react-native';

import { palette } from './tokens';

// DESIGN_SYSTEM §5: borders first; shadows only for floating layers. Ink-tinted, never black.
const level = (y: number, blur: number, opacity: number, android: number): ViewStyle =>
  Platform.OS === 'android'
    ? { elevation: android }
    : {
        shadowColor: palette.ink,
        shadowOffset: { width: 0, height: y },
        shadowRadius: blur / 2,
        shadowOpacity: opacity,
      };

export const elevation = {
  e2: level(2, 15, 0.07, 2),
  e3: level(4, 25, 0.1, 6),
  e4: level(10, 40, 0.15, 12),
} as const;
export type ElevationKey = keyof typeof elevation;
