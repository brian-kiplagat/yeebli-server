import type { Context } from 'hono';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import type { HLSService } from '../../service/hls.js';
import type { UserService } from '../../service/user.js';
import { type HLSUploadBody } from '../validator/hls.js';
import { ERRORS, serveBadRequest, serveInternalServerError } from './resp/error.js';

const processVideoSchema = z.object({
  videoId: z.number(),
  inputKey: z.string(),
});

export class HLSController {
  private service: HLSService;
  private userService: UserService;

  constructor(service: HLSService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const userId = c.get('jwtPayload')?.sub;
    if (!userId) return null;
    return this.userService.find(Number.parseInt(userId));
  }

  public upload = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: HLSUploadBody = await c.req.json();
      const { base64, resolutions } = body;

      if (!base64 || !resolutions) {
        return serveBadRequest(c, 'Missing base64 string or resolutions array');
      }

      // Convert base64 to File object
      const buffer = Buffer.from(base64, 'base64');
      const file = new File([buffer], 'input.mp4', { type: 'video/mp4' });

      const { hlsUrl } = await this.service.processUpload(file, resolutions || ['720p', '480p']);

      return c.json({ hlsUrl });
    } catch (error) {
      logger.error('Upload processing failed:', error);
      return serveInternalServerError(c, error);
    }
  };
}
