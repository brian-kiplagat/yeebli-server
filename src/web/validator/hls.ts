import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const MAX_FILE_SIZE = 1024 * 1024 * 500; // 500MB

export const resolutionSchema = z.enum(['1080p', '720p', '480p', '360p']);

export const hlsUploadSchema = z.object({
  base64: z
    .string()
    .min(1, 'Base64 string is required')
    .refine(
      (val) => {
        try {
          const buffer = Buffer.from(val, 'base64');
          return buffer.length <= MAX_FILE_SIZE;
        } catch {
          return false;
        }
      },
      `File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    ),
  resolutions: z
    .array(resolutionSchema)
    .min(1, { message: 'At least one resolution must be selected' })
    .max(4, { message: 'Maximum 4 resolutions can be selected' })
    .default(['720p', '480p']),
});

export const hlsUploadValidator = zValidator('json', hlsUploadSchema);

export type HLSUploadBody = z.infer<typeof hlsUploadSchema>;
export type Resolution = z.infer<typeof resolutionSchema>;
