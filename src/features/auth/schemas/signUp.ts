import { z } from 'zod';

// Password rules live in `passwordRules` (checklist + submit gate); the server re-checks them.
export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'Use 100 characters or fewer'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
