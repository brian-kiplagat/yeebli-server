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

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
});

const createTeamValidator = validator("json", (value, c) => {
  return validateSchema(c, createTeamSchema, value);
});

type InviteMemberBody = z.infer<typeof inviteMemberSchema>;
type TeamQuery = z.infer<typeof teamQuerySchema>;
type CreateTeamBody = z.infer<typeof createTeamSchema>;

export {
  type InviteMemberBody,
  type TeamQuery,
  type CreateTeamBody,
  inviteMemberValidator,
  teamQueryValidator,
  createTeamValidator,
};
