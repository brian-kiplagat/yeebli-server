import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  event_id: z.number().min(1, 'Event ID is required'),
  membership_level: z.enum(['Silver', 'Gold', 'Platinum']),
  membership_active: z.boolean().default(false),
  form_identifier: z.string().min(1, 'Form Identifier is required'),
  host_id: z.number().min(1, 'Host ID is required'),
  status_identifier: z.enum(['Manual', 'Form', 'Interested', 'Member', 'Inactive Member']),
  user_id: z.number().optional(),
});

const updateLeadSchema = leadSchema.partial();

type LeadBody = z.infer<typeof leadSchema>;

export const leadValidator = zValidator('json', leadSchema);
export const updateLeadValidator = zValidator('json', updateLeadSchema);
export type { LeadBody };
