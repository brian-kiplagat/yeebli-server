import { Worker } from "bullmq";
import { connection } from "../lib/queue.js";
import { S3Service } from "../service/s3.js";
import { AssetService } from "../service/asset.js";
import { HLSService } from "../service/hls.js";
import { logger } from "../lib/logger.js";
import { AssetRepository } from "../repository/asset.js";

export function startHLSWorker() {
  const s3Service = new S3Service();
  const assetRepo = new AssetRepository();
  const assetService = new AssetService(assetRepo, s3Service);
  const hlsService = new HLSService(s3Service, assetService);

  const worker = new Worker(
    "hls-video-processing",
    async (job) => {
      const { videoId, inputKey } = job.data;
      logger.info(`Processing video ${videoId} from ${inputKey}`);

      try {
        // Update status to processing
        await assetService.updateAsset(videoId, {
          processing_status: "processing",
        });

        // Convert to HLS
        const result = await hlsService.convertToHLS(videoId, inputKey);
        logger.info(`Successfully processed video ${videoId}`, result);

        return result;
      } catch (error) {
        logger.error(`Failed to process video ${videoId}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Process one video at a time to avoid overloading the server
    }
  );

  worker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, error) => {
    logger.error(`Job ${job?.id} failed:`, error);
  });

  return worker;
}
