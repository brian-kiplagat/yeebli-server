import { validator } from "hono/validator";
import { z } from "zod";
import { validateSchema } from "./validator.js";

const inviteMemberSchema = z.object({
  invitee_email: z.string().email(),
  team_id: z.number().int().positive(),
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

const revokeAccessSchema = z.object({
  team_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
});

const revokeAccessValidator = validator("json", (value, c) => {
  return validateSchema(c, revokeAccessSchema, value);
});

type InviteMemberBody = z.infer<typeof inviteMemberSchema>;
type TeamQuery = z.infer<typeof teamQuerySchema>;
type CreateTeamBody = z.infer<typeof createTeamSchema>;
type RevokeAccessBody = z.infer<typeof revokeAccessSchema>;
export {
  type InviteMemberBody,
  type TeamQuery,
  type CreateTeamBody,
  type RevokeAccessBody,
  inviteMemberValidator,
  teamQueryValidator,
  createTeamValidator,
  revokeAccessValidator,
};
