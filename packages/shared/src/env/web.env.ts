import { z } from 'zod';

export const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  NEXTAUTH_SECRET: z.string().min(32),
  AUTH_SECRET: z.string().min(32),
  APP_TIMEZONE: z.string().default('Australia/Perth'),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
