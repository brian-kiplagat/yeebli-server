import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { HLSService } from "../../service/hls.js";
import type { UserService } from "../../service/user.js";
import type { AssetService } from "../../service/asset.js";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.js";
import { z } from "zod";
import { createReadStream } from "fs";
import { statSync } from "fs";

const processVideoSchema = z.object({
  videoId: z.number(),
  inputKey: z.string(),
});

export class HLSController {
  private service: HLSService;
  private userService: UserService;
  private assetService: AssetService;

  constructor(
    service: HLSService,
    userService: UserService,
    assetService: AssetService
  ) {
    this.service = service;
    this.userService = userService;
    this.assetService = assetService;
  }

  private async getUser(c: Context) {
    const userId = c.get("jwtPayload")?.sub;
    if (!userId) return null;
    return this.userService.find(parseInt(userId));
  }

  public upload = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const formData = await c.req.formData();
      const file = formData.get("file") as File;

      if (!file || !file.name.endsWith(".mp4")) {
        return serveBadRequest(
          c,
          "Invalid file format. Only MP4 files are supported."
        );
      }

      const { zipPath, tempDir } = await this.service.processUpload(file);

      // Set headers for ZIP download
      c.header("Content-Type", "application/zip");
      c.header("Content-Disposition", `attachment; filename="hls_output.zip"`);

      // Stream the ZIP file
      const fileStream = createReadStream(zipPath);
      const stats = statSync(zipPath);
      c.header("Content-Length", stats.size.toString());

      // Clean up after sending the file
      const response = new Response(fileStream as any);
      response.headers.set("X-Cleanup-After", "true");

      // Clean up temp directory after response is sent
      this.service.cleanupTempDir(tempDir).catch((error) => {
        logger.error("Failed to cleanup temp directory:", error);
      });

      return response;
    } catch (error) {
      logger.error("Upload processing failed:", error);
      return serveInternalServerError(c, error);
    }
  };

  public processVideo = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body = await c.req.json();
      const { videoId, inputKey } = processVideoSchema.parse(body);

      const result = await this.service.processVideo(videoId, inputKey);
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public processPendingVideos = async (c: Context) => {
    try {
      const unprocessedVideos = await this.assetService.findUnprocessedVideos();
      logger.info(`Found ${unprocessedVideos.length} unprocessed videos`);

      const results = [];
      for (const video of unprocessedVideos) {
        try {
          if (!video.asset_url) continue;

          const inputKey = this.assetService.getKeyFromUrl(video.asset_url);
          const result = await this.service.processVideo(video.id, inputKey);
          results.push({ videoId: video.id, status: "queued" });

          logger.info(`Queued video ${video.id} for HLS processing`);
        } catch (error) {
          logger.error(`Failed to process video ${video.id}:`, error);
          results.push({
            videoId: video.id,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
      }

      return c.json({
        processed: unprocessedVideos.length,
        results,
        message: `Queued ${unprocessedVideos.length} videos for processing`,
      });
    } catch (error) {
      logger.error("Failed to process videos:", error);
      return serveInternalServerError(c, error);
    }
  };
}
