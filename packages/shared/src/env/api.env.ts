import { z } from 'zod';

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email().default('noreply@bookingplatform.au'),

  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_TIMEZONE: z.string().default('Australia/Perth'),

  SEAT_HOLD_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),
  REMINDER_LEAD_HOURS: z.coerce.number().int().positive().default(24),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
