import { zValidator } from '@hono/zod-validator';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { z } from 'zod';

const base64ImageRegex = /^data:image\/(jpeg|png|gif|webp);base64,/;
const MAX_LOGO_SIZE = 10 * 1024 * 1024; // 10MB in bytes

function validateBase64Size(base64String: string): boolean {
  // Remove the data:image/xyz;base64, prefix
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  // Calculate size in bytes (base64 string length * 0.75)
  const sizeInBytes = base64Data.length * 0.75;
  return sizeInBytes <= MAX_LOGO_SIZE;
}

const businessSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z
    .string()
    .refine(
      (phone) => {
        try {
          return isValidPhoneNumber(phone);
        } catch (error) {
          return false;
        }
      },
      {
        message: 'Invalid phone number format. Must include country code (e.g., +1, +44, +81)',
      },
    )
    .optional(),
  email: z.string().email().optional(),
  description: z.string().optional(),
  logo: z
    .string()
    .regex(base64ImageRegex, { message: 'Invalid image format' })
    .refine(validateBase64Size, { message: 'Logo size must be less than 10MB' })
    .or(z.string().url())
    .optional(),
  logoFileName: z.string().optional(),
  banner: z.string().optional(),
  user_id: z.number().optional(),
  imageBase64: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
});

export const businessValidator = zValidator('json', businessSchema);
const businessQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

export const businessQueryValidator = zValidator('query', businessQuerySchema);
export type BusinessQuery = z.infer<typeof businessQuerySchema>;
export type BusinessBody = z.infer<typeof businessSchema>;
