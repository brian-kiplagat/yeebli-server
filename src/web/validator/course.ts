import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const courseSchema = z.object({
  course_name: z.string().min(1),
  course_description: z.string(),
  instructions: z.string().optional(),
  landing_page_url: z.string().optional(),
  cover_image_asset_id: z.number(),
  course_type: z.enum(['self_paced', 'instructor_led']),
  status: z.enum(['draft', 'published', 'archived']),
  membership_plans: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        price: z.number(),
        isFree: z.boolean(),
        description: z.string().optional(),
      }),
    )
    .min(1),
});

const courseStreamSchema = z.object({
  course_id: z.number(),
  token: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  isHost: z.boolean().nullable().optional(),
});

export const courseValidator = zValidator('json', courseSchema);
export const courseStreamValidator = zValidator('json', courseStreamSchema);
const updateCourseSchema = courseSchema.partial();
export const updateCourseValidator = zValidator('json', updateCourseSchema);

const archiveCourseSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
  id: z.number(),
});

export const archiveCourseValidator = zValidator('json', archiveCourseSchema);

export const courseQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
});

export const courseQueryValidator = zValidator('query', courseQuerySchema);

export type CourseQuery = z.infer<typeof courseQuerySchema>;
export type UpdateCourseBody = z.infer<typeof updateCourseSchema>;
export type ArchiveCourseBody = z.infer<typeof archiveCourseSchema>;
export type CreateCourseBody = z.infer<typeof courseSchema>;
export type CourseStreamBody = z.infer<typeof courseStreamSchema>;
