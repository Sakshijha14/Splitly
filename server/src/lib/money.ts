import { z } from 'zod';

/** A rupee amount from the browser, e.g. 1200.5, turned into whole paise (120050). */
export const rupeesToPaise = z
  .number({ invalid_type_error: 'Enter an amount' })
  .positive('Amount must be more than 0')
  .max(10_000_000, 'Amount is too large')
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Use at most 2 decimal places')
  .transform((n) => Math.round(n * 100));
