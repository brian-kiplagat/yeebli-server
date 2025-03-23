import { validator } from 'hono/validator';
import { z } from 'zod';
import { validateSchema } from './validator.js';

// For webhook events from Stripe
const stripeWebhookSchema = z.object({
  type: z.string(),
  data: z
    .object({
      object: z.record(z.any()),
    })
    .optional(),
  account: z.string().optional(),
});

const stripeWebhookValidator = validator('json', (value, c) => {
  return validateSchema(c, stripeWebhookSchema, value);
});

// For custom return URL (optional)
const stripeUrlSchema = z.object({
  return_url: z.string().url().optional(),
  refresh_url: z.string().url().optional(),
});

const stripeUrlValidator = validator('json', (value, c) => {
  return validateSchema(c, stripeUrlSchema, value);
});

type StripeWebhookBody = z.infer<typeof stripeWebhookSchema>;
type StripeUrlBody = z.infer<typeof stripeUrlSchema>;

export { type StripeWebhookBody, type StripeUrlBody, stripeWebhookValidator, stripeUrlValidator };
