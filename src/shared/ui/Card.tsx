import type { ReactNode } from 'react';

import { Box } from './Box';

export function Card({ children }: { children: ReactNode }) {
  return (
    // 16 pt corners and a hairline, no shadow (Expedia's cards on white).
    <Box bg="surface" rounded="r4" border p="s5">
      {children}
    </Box>
  );
}
