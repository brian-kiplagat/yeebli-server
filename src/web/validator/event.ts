import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const eventSchema = z.object({
  event_name: z.string().min(1),
  event_description: z.string(),
  dates: z.array(z.string()),
  instructions: z.string().optional(),
  landing_page_url: z.string().optional(),
  asset_id: z.number(),
  event_type: z.enum(["live_venue", "prerecorded", "live_video_call"]),
  status: z.enum(["active", "suspended", "cancelled"]),
  lead_level: z.array(z.string()),
  live_video_url: z.string().optional(),
  live_venue_address: z.string().optional(),
  success_url: z.string().optional(),
});

export const eventValidator = zValidator("json", eventSchema);

const updateEventSchema = eventSchema.partial();
export const updateEventValidator = zValidator("json", updateEventSchema);

const cancelEventSchema = z.object({
  status: z.enum(["cancelled", "active", "suspended"]),
  id: z.number(),
});

export const cancelEventValidator = zValidator("json", cancelEventSchema);

export const eventQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

const upsertEventDateSchema = z.object({
  timestamp: z.string(),
});

export const upsertEventDateValidator = zValidator(
  "json",
  upsertEventDateSchema
);
export const eventQueryValidator = zValidator("query", eventQuerySchema);
export type UpsertEventDateBody = z.infer<typeof upsertEventDateSchema>;
export type EventQuery = z.infer<typeof eventQuerySchema>;
export type UpdateEventBody = z.infer<typeof updateEventSchema>;
export type CancelEventBody = z.infer<typeof cancelEventSchema>;
