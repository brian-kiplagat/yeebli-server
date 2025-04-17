import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const assetQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
  asset_type: z.enum(['image', 'video', 'audio', 'document']).optional(),
});

const createAssetSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  assetType: z.enum(["image", "video", "audio", "document"]),
  fileSize: z.number(),
  duration: z.number(),
});

const renameAssetSchema = z.object({
  fileName: z.string().refine((val) => /\.[a-zA-Z0-9]+$/.test(val), {
    message: "File name must include an extension",
  }),
});


export const assetQueryValidator = zValidator('query', assetQuerySchema);
export type CreateAssetBody = z.infer<typeof createAssetSchema>;
export type RenameAssetBody = z.infer<typeof renameAssetSchema>;
export type AssetQuery = z.infer<typeof assetQuerySchema>;
