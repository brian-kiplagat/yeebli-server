import { AssetService } from "./asset.js";
import { HLSService } from "./hls.js";
import { logger } from "../lib/logger.js";

export class CronService {
  private assetService: AssetService;
  private hlsService: HLSService;

  constructor(assetService: AssetService, hlsService: HLSService) {
    this.assetService = assetService;
    this.hlsService = hlsService;
  }

  async processUnprocessedVideos() {
    try {
      const unprocessedVideos = await this.assetService.findUnprocessedVideos();
      logger.info(`Found ${unprocessedVideos.length} unprocessed videos`);

      for (const video of unprocessedVideos) {
        try {
          if (!video.asset_url) continue;

          const inputKey = this.assetService.getKeyFromUrl(video.asset_url);
          await this.hlsService.processVideo(video.id, inputKey);

          logger.info(`Queued video ${video.id} for HLS processing`);
        } catch (error) {
          logger.error(`Failed to process video ${video.id}:`, error);
          // Continue with next video even if one fails
          continue;
        }
      }

      return {
        processed: unprocessedVideos.length,
        message: `Queued ${unprocessedVideos.length} videos for processing`,
      };
    } catch (error) {
      logger.error("Failed to process unprocessed videos:", error);
      throw error;
    }
  }
}
