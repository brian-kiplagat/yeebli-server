import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const membershipSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  price: z.number().min(0),
  payment_type: z.enum(['one_off', 'recurring']).default('one_off'),
  price_point: z.enum(['standalone', 'course']).default('standalone'),
  billing: z.enum(['per-day', 'package']).default('per-day'),
  dates: z.array(z.string()).min(1),
});

export const membershipValidator = zValidator('json', membershipSchema);

const membershipQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

const upsertEventDateSchema = z.object({
  timestamp: z.string(),
});
export const upsertEventDateValidator = zValidator('json', upsertEventDateSchema);
export const membershipQueryValidator = zValidator('query', membershipQuerySchema);

export type MembershipQuery = z.infer<typeof membershipQuerySchema>;
export type UpsertEventDateBody = z.infer<typeof upsertEventDateSchema>;
export type CreateMembershipBody = z.infer<typeof membershipSchema>;
export type UpdateMembershipBody = Partial<CreateMembershipBody>;
