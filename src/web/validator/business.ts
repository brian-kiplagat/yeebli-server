import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const businessSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  banner: z.string().optional(),
});

export const businessValidator = zValidator("json", businessSchema);

const businessQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

export const businessQueryValidator = zValidator("query", businessQuerySchema);
export type BusinessQuery = z.infer<typeof businessQuerySchema>;
