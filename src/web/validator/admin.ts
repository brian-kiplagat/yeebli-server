import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  role: z.enum(["master", "owner", "host", "user"]).optional(),
  search: z.string().optional(),
});

export const adminLeadQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  status: z
    .enum(["Manual", "Form", "Interested", "Member", "Inactive Member"])
    .optional(),
  membership_level: z.enum(["Silver", "Gold", "Platinum"]).optional(),
  search: z.string().optional(),
});

export const adminEventQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
  date_range: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
});

export const adminUserDetailsQuerySchema = z.object({
  include_events: z.coerce.boolean().optional().default(false),
  include_leads: z.coerce.boolean().optional().default(false),
  include_assets: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(100),
});

export const adminUpdateUserSchema = z
  .object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    role: z.enum(["master", "owner", "host", "user"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const adminCreateUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["master", "owner", "host", "user"]),
  phone: z.string(),
});

export const adminCreateUserValidator = zValidator(
  "json",
  adminCreateUserSchema
);

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminLeadQuery = z.infer<typeof adminLeadQuerySchema>;
export type AdminEventQuery = z.infer<typeof adminEventQuerySchema>;
export type AdminUserDetailsQuery = z.infer<typeof adminUserDetailsQuerySchema>;
export type AdminUpdateUser = z.infer<typeof adminUpdateUserSchema>;
