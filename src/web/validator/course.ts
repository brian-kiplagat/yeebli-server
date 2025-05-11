import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const courseSchema = z.object({
  course_name: z.string().min(1),
  course_description: z.string(),
  instructions: z.string().optional(),
  landing_page_url: z.string().optional(),
  trailer_asset_id: z.number(),
  course_type: z.enum(['self_paced', 'instructor_led']),
  status: z.enum(['draft', 'published', 'archived']),
  lessons: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    content: z.string().optional(),
    video_asset_id: z.number().int().optional(),
    lesson_duration: z.number().int().optional(),
  }),
  module: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
  }),
  membership_plans: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        price: z.number(),
        isFree: z.boolean(),
        description: z.string().optional(),
        payment_type: z.enum(['one_off', 'recurring']),
        price_point: z.enum(['course', 'podcast', 'standalone']),
        billing: z.enum(['per-day', 'package']),
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

export const moduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().min(0),
});

export const lessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string().optional(),
  video_asset_id: z.number().int().optional(),
  duration: z.number().int().optional(),
  order: z.number().int().min(0),
});

export const progressSchema = z.object({
  lesson_id: z.number().int(),
  status: z.enum(['not_started', 'in_progress', 'completed']),
  progress_percentage: z.number().int().min(0).max(100),
  last_position: z.number().int().min(0),
});

export const moduleValidator = zValidator('json', moduleSchema);
export const lessonValidator = zValidator('json', lessonSchema);
export const progressValidator = zValidator('json', progressSchema);

export type Module = z.infer<typeof moduleSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Progress = z.infer<typeof progressSchema>;
