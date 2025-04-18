import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const membershipSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  price: z.number().min(0),
  payment_type: z.enum(['one_off', 'recurring']).default('one_off'),
  price_point: z.enum(['ticket', 'course']).default('ticket'),
});

export const membershipValidator = zValidator('json', membershipSchema);

const membershipQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

export const membershipQueryValidator = zValidator('query', membershipQuerySchema);

export type MembershipQuery = z.infer<typeof membershipQuerySchema>;

export type CreateMembershipBody = z.infer<typeof membershipSchema>;
export type UpdateMembershipBody = Partial<CreateMembershipBody>;
