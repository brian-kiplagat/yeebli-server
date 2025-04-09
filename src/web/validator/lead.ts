import { zValidator } from "@hono/zod-validator";
import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().refine(
    (phone) => {
      try {
        return isValidPhoneNumber(phone);
      } catch (error) {
        return false;
      }
    },
    {
      message:
        "Invalid phone number format. Must include country code (e.g., +1, +44, +81)",
    }
  ),
  event_id: z.number().min(0, "Event ID is required").optional(),
  event_date_id: z.number().min(0, "Event Date ID is required").optional(),
  membership_level: z.enum(["Silver", "Gold", "Platinum"]),
  membership_active: z.boolean().default(false),
  form_identifier: z.string().min(1, "Form Identifier is required"),
  host_id: z.number().min(1, "Host ID is required"),
  status_identifier: z.enum([
    "Manual",
    "Form",
    "Interested",
    "Member",
    "Inactive Member",
  ]),
  user_id: z.number().optional(),
});

const leadUpgradeSchema = z.object({
  lead_id: z.number().min(1, "Lead ID is required"),
  membership_id: z.number().min(1, "Membership ID is required"),
});

const updateLeadSchema = leadSchema.partial();

// New validator for external form submissions
const externalFormSchema = z.object({
  lead_form_name: z
    .string()
    .min(1, "Name is required")
    .max(256, "Name is too long")
    .transform((val) => val.trim()),
  lead_form_email: z
    .string()
    .email("Invalid email address")
    .max(256, "Email is too long")
    .transform((val) => val.toLowerCase().trim()),
  lead_form_phone: z.string().refine(
    (phone) => {
      try {
        return isValidPhoneNumber(phone);
      } catch (error) {
        return false;
      }
    },
    {
      message:
        "Invalid phone number format. Must include country code (e.g., +1, +44, +81)",
    }
  ),
  event_id: z.string().transform((val) => Number.parseInt(val, 10)),
  registered_date: z.string().min(1, "Selected date is required").optional(),
  host_id: z.string().transform((val) => Number.parseInt(val, 10)),
  "cf-turnstile-response": z.string().min(1, "Turnstile response is required"),
});

const eventLinkSchema = z.object({
  event_id: z.number().min(1, "Event ID is required"),
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Invalid email address"),
});

type LeadUpgradeBody = z.infer<typeof leadUpgradeSchema>;
type LeadBody = z.infer<typeof leadSchema>;
type ExternalFormBody = z.infer<typeof externalFormSchema>;
type EventLinkBody = z.infer<typeof eventLinkSchema>;
export const eventLinkValidator = zValidator("json", eventLinkSchema);
export const leadValidator = zValidator("json", leadSchema);
export const updateLeadValidator = zValidator("json", updateLeadSchema);
export const externalFormValidator = zValidator("form", externalFormSchema);
export const leadUpgradeValidator = zValidator("json", leadUpgradeSchema);
export type { LeadBody, ExternalFormBody, EventLinkBody, LeadUpgradeBody };
export { externalFormSchema };
