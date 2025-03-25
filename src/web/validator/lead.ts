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

// New validator for external form submissions
const externalFormSchema = z.object({
  lead_form_name: z
    .string()
    .min(1, 'Name is required')
    .max(256, 'Name is too long')
    .transform((val) => val.trim()),
  lead_form_email: z
    .string()
    .email('Invalid email address')
    .max(256, 'Email is too long')
    .transform((val) => val.toLowerCase().trim()),
  lead_form_phone: z
    .string()
    .min(1, 'Phone is required')
    .max(256, 'Phone is too long')
    .transform((val) => val.replace(/[^\d+]/g, '')), // Remove non-digit characters except +
  event_id: z.string().transform((val) => Number.parseInt(val, 10)),
  host_id: z.string().transform((val) => Number.parseInt(val, 10)),
  'cf-turnstile-response': z.string().min(1, 'Turnstile response is required'),
});

type LeadBody = z.infer<typeof leadSchema>;
type ExternalFormBody = z.infer<typeof externalFormSchema>;

export const leadValidator = zValidator('json', leadSchema);
export const updateLeadValidator = zValidator('json', updateLeadSchema);
export const externalFormValidator = zValidator('form', externalFormSchema);
export type { LeadBody, ExternalFormBody };
export { externalFormSchema };
