import type { Context } from 'hono';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import type { S3Service } from '../../service/s3.js';
import { ERRORS, serveBadRequest, serveInternalServerError } from './resp/error.js';

const generateUrlSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
});

export class S3Controller {
  private service: S3Service;

  constructor(service: S3Service) {
    this.service = service;
  }

  public generatePresignedUrl = async (c: Context) => {
    try {
      const body = await c.req.json();
      const { fileName, contentType } = generateUrlSchema.parse(body);

      // Generate a unique key for the file
      const key = `uploads/${Date.now()}-${fileName}`;

      const result = await this.service.generatePresignedUrl(key, contentType);
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
