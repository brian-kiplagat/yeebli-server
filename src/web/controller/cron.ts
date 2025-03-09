import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { CronService } from "../../service/cron.js";
import { serveInternalServerError } from "./resp/error.js";

export class CronController {
  private service: CronService;

  constructor(service: CronService) {
    this.service = service;
  }

  public processVideos = async (c: Context) => {
    try {
      const result = await this.service.processUnprocessedVideos();
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
