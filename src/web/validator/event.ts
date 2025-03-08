import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const eventSchema = z.object({
  event_name: z.string().min(1),
  event_description: z.string(),
  event_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  asset_id: z.string(),
});

export const eventValidator = zValidator("json", eventSchema);

const updateEventSchema = eventSchema.partial();
export const updateEventValidator = zValidator("json", updateEventSchema);

export const eventQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

export const eventQueryValidator = zValidator("query", eventQuerySchema);

export type EventQuery = z.infer<typeof eventQuerySchema>;
