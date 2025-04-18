import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const subscriptionSchema = z.object({
  priceId: z.string(),
  productId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const subscriptionRequestValidator = validator('json', (value, c) => {
  return validateSchema(c, subscriptionSchema, value);
});

type SubscriptionRequestBody = z.infer<typeof subscriptionSchema>;

export { type SubscriptionRequestBody, subscriptionRequestValidator };
