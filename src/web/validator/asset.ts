import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const assetQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
  asset_type: z.enum(['image', 'video', 'audio', 'document']).optional(),
});

export const assetQueryValidator = zValidator('query', assetQuerySchema);

export type AssetQuery = z.infer<typeof assetQuerySchema>;
