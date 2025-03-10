import { Queue } from "bullmq";
import { connection } from "../lib/queue.js";
import { S3Service } from "./s3.js";
import { AssetService } from "./asset.js";
import { logger } from "../lib/logger.js";
import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import env from "../lib/env.js";

const execAsync = promisify(exec);

export class HLSService {
  private s3Service: S3Service;
  private assetService: AssetService;
  private videoQueue: Queue;
  private tempDir: string;

  constructor(s3Service: S3Service, assetService: AssetService) {
    this.s3Service = s3Service;
    this.assetService = assetService;
    this.videoQueue = new Queue("hls-video-processing", { connection });
    this.tempDir = path.join(process.cwd(), "temp");
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error("Failed to create temp directory:", error);
      throw error;
    }
  }

  async processVideo(videoId: number, inputKey: string) {
    // Add to processing queue
    await this.videoQueue.add(
      "convert-to-hls",
      {
        videoId,
        inputKey,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      }
    );

    return { message: "Video processing started", videoId };
  }

  async convertToHLS(videoId: number, inputKey: string) {
    try {
      // Create temporary directories for processing
      const videoTempDir = path.join(this.tempDir, videoId.toString());
      await fs.mkdir(videoTempDir, { recursive: true });

      // Download video from S3
      const inputUrl = await this.s3Service.generateGetUrl(
        inputKey,
        "video/mp4"
      );
      const inputPath = path.join(videoTempDir, "input.mp4");

      // Download using curl (more reliable for large files)
      await execAsync(`curl -o "${inputPath}" "${inputUrl}"`);

      // Create HLS output directory
      const hlsOutputDir = path.join(videoTempDir, "hls");
      await fs.mkdir(hlsOutputDir, { recursive: true });

      // FFmpeg command to generate HLS with multiple quality variants
      const ffmpegCmd = `ffmpeg -i "${inputPath}" \
        -filter_complex "[0:v]split=4[v1][v2][v3][v4]; \
          [v1]scale=w=1920:h=1080[v1out]; \
          [v2]scale=w=1280:h=720[v2out]; \
          [v3]scale=w=854:h=480[v3out]; \
          [v4]scale=w=640:h=360[v4out]" \
        -map "[v1out]" -map 0:a -c:v libx264 -c:a aac -b:v:0 5000k -b:a:0 192k \
        -map "[v2out]" -map 0:a -c:v libx264 -c:a aac -b:v:1 2800k -b:a:1 128k \
        -map "[v3out]" -map 0:a -c:v libx264 -c:a aac -b:v:2 1400k -b:a:2 128k \
        -map "[v4out]" -map 0:a -c:v libx264 -c:a aac -b:v:3 800k -b:a:3 96k \
        -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3" \
        -master_pl_name master.m3u8 \
        -f hls -hls_time 6 -hls_list_size 0 \
        -hls_segment_filename "${hlsOutputDir}/%v/segment%d.ts" \
        "${hlsOutputDir}/%v/playlist.m3u8"`;

      // Execute FFmpeg command
      await execAsync(ffmpegCmd);

      // Upload HLS files to S3
      const s3BasePath = `assets/hls/video/${videoId}`;

      // Upload master playlist
      const masterContent = await fs.readFile(
        path.join(hlsOutputDir, "master.m3u8"),
        "utf8"
      );
      await this.s3Service.uploadFile(
        `${s3BasePath}/master.m3u8`,
        masterContent,
        "application/x-mpegURL"
      );

      // Upload variant playlists and segments
      const variants = ["0", "1", "2", "3"]; // Corresponds to 1080p, 720p, 480p, 360p
      for (const variant of variants) {
        const variantDir = path.join(hlsOutputDir, variant);
        const files = await fs.readdir(variantDir);

        for (const file of files) {
          const filePath = path.join(variantDir, file);
          const content = await fs.readFile(filePath);
          const s3Key = `${s3BasePath}/${variant}/${file}`;
          const contentType = file.endsWith(".m3u8")
            ? "application/x-mpegURL"
            : "video/MP2T";

          await this.s3Service.uploadFile(s3Key, content, contentType);
        }
      }

      // Generate HLS URL
      const hlsUrl = `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${s3BasePath}/master.m3u8`;

      // Update asset with HLS URL
      await this.assetService.updateAsset(videoId, {
        hls_url: hlsUrl,
        processing_status: "completed",
      });

      // Cleanup temporary files
      await fs.rm(videoTempDir, { recursive: true, force: true });

      return { hlsUrl };
    } catch (error) {
      logger.error("Failed to convert video to HLS:", error);
      await this.assetService.updateAsset(videoId, {
        processing_status: "failed",
      });
      throw error;
    }
  }
}
