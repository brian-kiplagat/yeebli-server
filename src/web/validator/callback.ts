import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const callbackSchema = z.object({
  lead_id: z.number().int().positive(),
  event_id: z.number().int().positive(),
  callback_type: z.enum(['instant', 'scheduled']),
  scheduled_time: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  host_id: z.number().int().positive(),
});

const callbackValidator = validator('json', (value, c) => {
  return validateSchema(c, callbackSchema, value);
});

const updateCallbackSchema = z.object({
  callback_type: z.enum(['instant', 'scheduled']).optional(),
  scheduled_time: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['called', 'uncalled']).optional(),
});

const updateCallbackValidator = validator('json', (value, c) => {
  return validateSchema(c, updateCallbackSchema, value);
});

const callbackQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  status: z.enum(['called', 'uncalled']).optional(),
  callback_type: z.enum(['instant', 'scheduled']).optional(),
});

type CallbackBody = z.infer<typeof callbackSchema>;
type UpdateCallbackBody = z.infer<typeof updateCallbackSchema>;
type CallbackQuery = z.infer<typeof callbackQuerySchema>;

export {
  type CallbackBody,
  type CallbackQuery,
  callbackValidator,
  type UpdateCallbackBody,
  updateCallbackValidator,
};
