import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  event_url: z.string().min(1, 'Event URL is required'),
  event_date: z.string().min(1, 'Event Date is required'),
  start_time: z.string().min(1, 'Start Time is required'),
  membership_level: z.enum(['Silver', 'Gold', 'Platinum']),
  membership_active: z.boolean().default(false),
  form_identifier: z.string().min(1, 'Form Identifier is required'),
  host_id: z.number().min(1, 'Host ID is required'),
  status_identifier: z.enum(['Manual', 'Form', 'Interested', 'Member', 'Inactive Member']),
  user_id: z.number().optional(),
});

type LeadBody = z.infer<typeof leadSchema>;

export const leadValidator = zValidator('json', leadSchema);

export type { LeadBody };
