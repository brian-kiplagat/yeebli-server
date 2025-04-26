import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const podcastSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  cover_image_asset_id: z.number(),
  podcast_type: z.enum(['prerecorded', 'link']),
  episode_type: z.enum(['single', 'multiple']),
  status: z.enum(['draft', 'published', 'archived']),
  link_url: z.string().optional(),
  assets: z.array(z.number()).optional(),
});

const podcastEpisodeSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  audio_asset_id: z.number(),
  order: z.number().optional(),
});

export const podcastValidator = zValidator('json', podcastSchema);
export const podcastEpisodeValidator = zValidator('json', podcastEpisodeSchema);

const updatePodcastSchema = podcastSchema.partial();
export const updatePodcastValidator = zValidator('json', updatePodcastSchema);

const updateEpisodeSchema = podcastEpisodeSchema.partial();
export const updateEpisodeValidator = zValidator('json', updateEpisodeSchema);

export const podcastQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
});

export const podcastQueryValidator = zValidator('query', podcastQuerySchema);

export type PodcastQuery = z.infer<typeof podcastQuerySchema>;
export type UpdatePodcastBody = z.infer<typeof updatePodcastSchema>;
export type UpdateEpisodeBody = z.infer<typeof updateEpisodeSchema>;
export type CreatePodcastBody = z.infer<typeof podcastSchema>;
export type CreateEpisodeBody = z.infer<typeof podcastEpisodeSchema>;
