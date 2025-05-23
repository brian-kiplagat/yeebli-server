import type { Context } from 'hono';
import type { ZodError, ZodObject } from 'zod';

import { serveUnprocessableEntity } from '../controller/resp/error.js';

const getErrorPhrase = (error: ZodError) => {
  const path = error.issues[0].path[0];
  const { message } = error.issues[0];
  return `${path}: ${message}`;
};

const validateSchema = (c: Context, schema: ZodObject<any>, value: any) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return serveUnprocessableEntity(c, getErrorPhrase(parsed.error));
  }
  return parsed.data;
};

export { getErrorPhrase, validateSchema };
