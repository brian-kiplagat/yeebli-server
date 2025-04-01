import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const base64ImageRegex = /^data:image\/(jpeg|png|gif|webp);base64,/;
const MAX_LOGO_SIZE = 10 * 1024 * 1024; // 10MB in bytes

function validateBase64Size(base64String: string): boolean {
  // Remove the data:image/xyz;base64, prefix
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
  // Calculate size in bytes (base64 string length * 0.75)
  const sizeInBytes = base64Data.length * 0.75;
  return sizeInBytes <= MAX_LOGO_SIZE;
}

const businessSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  description: z.string().optional(),
  logo: z
    .string()
    .regex(base64ImageRegex, { message: "Invalid image format" })
    .refine(validateBase64Size, { message: "Logo size must be less than 10MB" })
    .or(z.string().url())
    .optional(),
  logoFileName: z.string().optional(),
  banner: z.string().optional(),
  user_id: z.number().optional(),
});

export const businessValidator = zValidator("json", businessSchema);

const businessQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

export const businessQueryValidator = zValidator("query", businessQuerySchema);
export type BusinessQuery = z.infer<typeof businessQuerySchema>;
export type BusinessBody = z.infer<typeof businessSchema>;
