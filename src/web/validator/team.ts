import { validator } from "hono/validator";
import { z } from "zod";
import { validateSchema } from "./validator.js";

const inviteMemberSchema = z.object({
  invitee_email: z.string().email(),
});

const inviteMemberValidator = validator("json", (value, c) => {
  return validateSchema(c, inviteMemberSchema, value);
});

const teamQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  search: z.string().optional(),
});

const teamQueryValidator = validator("query", (value, c) => {
  return validateSchema(c, teamQuerySchema, value);
});

type InviteMemberBody = z.infer<typeof inviteMemberSchema>;
type TeamQuery = z.infer<typeof teamQuerySchema>;

export {
  type InviteMemberBody,
  type TeamQuery,
  inviteMemberValidator,
  teamQueryValidator,
};
