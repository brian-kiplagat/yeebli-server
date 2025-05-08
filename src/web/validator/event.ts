import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const eventSchema = z.object({
  event_name: z.string().min(1),
  event_description: z.string(),
  instructions: z.string().optional(),
  landing_page_url: z.string().optional(),
  asset_id: z.number(),
  event_type: z.enum(['live_venue', 'prerecorded', 'live_video_call']),
  status: z.enum(['active', 'suspended', 'cancelled']),
  live_video_url: z.string().optional(),
  live_venue_address: z.string().optional(),
  success_url: z.string().optional(),
  membership_plans: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        date: z.number(),
        cost: z.number(),
        isFree: z.boolean(),
      }),
    )
    .min(1),
});

const eventStreamSchema = z.object({
  event_id: z.number(),
  token: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  isHost: z.boolean().nullable().optional(),
});

export const eventValidator = zValidator('json', eventSchema);
export const eventStreamValidator = zValidator('json', eventStreamSchema);
const updateEventSchema = eventSchema.partial();
export const updateEventValidator = zValidator('json', updateEventSchema);

const cancelEventSchema = z.object({
  status: z.enum(['cancelled', 'active', 'suspended']),
  id: z.number(),
});

export const cancelEventValidator = zValidator('json', cancelEventSchema);

export const eventQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
});

export const eventQueryValidator = zValidator('query', eventQuerySchema);

export type EventQuery = z.infer<typeof eventQuerySchema>;
export type UpdateEventBody = z.infer<typeof updateEventSchema>;
export type CancelEventBody = z.infer<typeof cancelEventSchema>;
export type CreateEventBody = z.infer<typeof eventSchema>;
export type EventStreamBody = z.infer<typeof eventStreamSchema>;
