import type { ReactNode } from 'react';

import { Box } from './Box';

export function Card({ children }: { children: ReactNode }) {
  return (
    <Box bg="surface" rounded="r3" border p="s5">
      {children}
    </Box>
  );
}
