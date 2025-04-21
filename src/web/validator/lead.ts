import { zValidator } from '@hono/zod-validator';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { z } from 'zod';

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().refine(
    (phone) => {
      try {
        return isValidPhoneNumber(phone);
      } catch {
        return false;
      }
    },
    {
      message: 'Invalid phone number format. Must include country code (e.g., +1, +44, +81)',
    },
  ),
  event_id: z.number().min(0, 'Event ID is required').nullable().optional(),
  host_id: z.number().min(1, 'Host ID is required'),
});

const leadUpgradeSchema = z.object({
  lead_id: z.number().min(1, 'Lead ID is required'),
  membership_id: z.number().min(1, 'Membership ID is required'),
});

const updateLeadSchema = leadSchema.partial();

// New validator for external form submissions
const externalFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(256, 'Name is too long')
    .transform((val) => val.trim()),
  email: z
    .string()
    .email('Invalid email address')
    .max(256, 'Email is too long')
    .transform((val) => val.toLowerCase().trim()),
  phone: z.string().refine(
    (phone) => {
      try {
        return isValidPhoneNumber(phone);
      } catch {
        return false;
      }
    },
    {
      message: 'Invalid phone number format. Must include country code (e.g., +1, +44, +81)',
    },
  ),
  event_id: z.string().transform((val) => Number.parseInt(val, 10)),
  host_id: z.string().transform((val) => Number.parseInt(val, 10)),
  'cf-turnstile-response': z.string().min(1, 'Turnstile response is required'),
});

const eventLinkSchema = z.object({
  event_id: z.number().min(1, 'Event ID is required'),
  token: z.string().min(1, 'Token is required'),
  email: z.string().email('Invalid email address'),
});

const purchaseMembershipSchema = z.object({
  event_id: z.number().min(1, 'Event ID is required'),
  membership_id: z.number().min(1, 'Membership ID is required'),
  token: z.string().min(1, 'Token is required'),
  email: z.string().email('Invalid email address'),
  dates: z.array(z.number()).min(1, 'At least one date is required'),
});

type LeadUpgradeBody = z.infer<typeof leadUpgradeSchema>;
type LeadBody = z.infer<typeof leadSchema>;
type ExternalFormBody = z.infer<typeof externalFormSchema>;
type EventLinkBody = z.infer<typeof eventLinkSchema>;
type PurchaseMembershipBody = z.infer<typeof purchaseMembershipSchema>;
export const eventLinkValidator = zValidator('json', eventLinkSchema);
export const leadValidator = zValidator('json', leadSchema);
export const updateLeadValidator = zValidator('json', updateLeadSchema);
export const externalFormValidator = zValidator('form', externalFormSchema);
export const leadUpgradeValidator = zValidator('json', leadUpgradeSchema);
export const purchaseMembershipValidator = zValidator('json', purchaseMembershipSchema);
export type { EventLinkBody, ExternalFormBody, LeadBody, LeadUpgradeBody, PurchaseMembershipBody };
export { externalFormSchema };
