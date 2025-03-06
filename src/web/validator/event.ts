import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const eventValidator = zValidator(
  'json',
  z.object({
    event_name: z.string().min(1),
    event_description: z.string(),
    event_date: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    asset_id: z.string(),

  }),
);
