import { useWindowDimensions } from 'react-native';

import { layout } from '@/shared/theme';

// Tablet two-pane / left tab rail (DESIGN_SYSTEM §2). A hook, never module scope: rotation changes it.
export function useWide(): boolean {
  return useWindowDimensions().width >= layout.tabletBreakpoint;
}
