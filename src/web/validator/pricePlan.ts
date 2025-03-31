import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const pricePlanSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  price: z.number().min(0),
  payment_type: z.enum(['one_off', 'recurring']).default('one_off'),
});

export const pricePlanValidator = zValidator('json', pricePlanSchema);

const updatePricePlanSchema = pricePlanSchema.partial();
export const updatePricePlanValidator = zValidator('json', updatePricePlanSchema);

const pricePlanQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

export const pricePlanQueryValidator = zValidator('query', pricePlanQuerySchema);

export type PricePlanQuery = z.infer<typeof pricePlanQuerySchema>;
export type UpdatePricePlanBody = z.infer<typeof updatePricePlanSchema>;
export type CreatePricePlanBody = z.infer<typeof pricePlanSchema>;
