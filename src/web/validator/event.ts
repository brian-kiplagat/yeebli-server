import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const eventSchema = z.object({
  event_name: z.string().min(1),
  event_description: z.string(),
  event_date: z.string(),
  other_dates: z.array(z.string()).optional(),
  instructions: z.string().optional(),
  landing_page_url: z.string().optional(),
  asset_id: z.string(),
  status: z.enum(["active", "suspended", "cancelled"]),
});

export const eventValidator = zValidator('json', eventSchema);

const updateEventSchema = eventSchema.partial();
export const updateEventValidator = zValidator('json', updateEventSchema);

const cancelEventSchema = z.object({
  status: z.enum(['cancelled', 'active', 'suspended']),
  id: z.number(),
});

export const cancelEventValidator = zValidator('json', cancelEventSchema);

export const eventQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

export const eventQueryValidator = zValidator('query', eventQuerySchema);
export type EventQuery = z.infer<typeof eventQuerySchema>;
