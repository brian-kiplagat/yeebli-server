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
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { createWriteStream } from "fs";
import archiver from "archiver";

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

  public async processUpload(
    file: File
  ): Promise<{ zipPath: string; tempDir: string }> {
    const tempDir = join(process.cwd(), "temp", Date.now().toString());
    const outputDir = join(tempDir, "output");
    const zipPath = join(tempDir, "hls_output.zip");

    try {
      // Create directories in parallel
      await Promise.all([
        mkdir(tempDir, { recursive: true }),
        mkdir(outputDir, { recursive: true }),
      ]);

      // Save uploaded file
      const buffer = Buffer.from(await file.arrayBuffer());
      const inputPath = join(tempDir, file.name);
      await writeFile(inputPath, buffer);

      type Resolution = "1080p" | "720p" | "480p" | "360p";
      const allowList: Resolution[] = ["720p", "480p"]; // Allowed resolutions

      const resolutions = {
        "1080p": {
          width: 1920,
          height: 1080,
          bitrate: 5000,
          maxrate: 5350,
          bufsize: 7500,
        },
        "720p": {
          width: 1280,
          height: 720,
          bitrate: 2800,
          maxrate: 2996,
          bufsize: 4200,
        },
        "480p": {
          width: 854,
          height: 480,
          bitrate: 1400,
          maxrate: 1498,
          bufsize: 2100,
        },
        "360p": {
          width: 640,
          height: 360,
          bitrate: 800,
          maxrate: 900,
          bufsize: 1200,
        },
      };

      // Generate filter_complex dynamically
      const videoFilters = allowList
        .map(
          (res, index) =>
            `[v${index}]scale=w=${resolutions[res].width}:h=${resolutions[res].height}[v${index}out]`
        )
        .join("; ");

      // Generate -map and encoding settings dynamically
      const videoMaps = allowList
        .map(
          (res, index) =>
            `-map "[v${index}out]" -c:v:${index} libx264 -b:v:${index} ${resolutions[res].bitrate}k ` +
            `-maxrate:v:${index} ${resolutions[res].maxrate}k -bufsize:v:${index} ${resolutions[res].bufsize}k -preset ultrafast`
        )
        .join(" ");

      const audioMaps = allowList
        .map((_, index) => `-map a:0 -c:a aac -b:a:${index} 128k -ac 2`)
        .join(" ");

      const streamMap = allowList
        .map((_, index) => `v:${index},a:${index}`)
        .join(" ");

      // Construct FFmpeg command dynamically
      const ffmpegCommand = `ffmpeg -i "${inputPath}" \
  -filter_complex "[0:v]split=${allowList.length}${allowList.map((_, i) => `[v${i}]`).join("")}; ${videoFilters}" \
  ${videoMaps} \
  ${audioMaps} \
  -f hls \
  -hls_time 10 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -hls_segment_filename "${outputDir}/stream_%v/data%03d.ts" \
  -master_pl_name master.m3u8 \
  -var_stream_map "${streamMap}" \
  "${outputDir}/stream_%v/playlist.m3u8"`;

      logger.info(ffmpegCommand);

      // Execute FFmpeg with increased buffer size
      await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 500 });

      // Create ZIP file using archiver with optimized settings
      const archive = archiver("zip", {
        zlib: { level: 9 },
        store: true,
      });

      const writeStream = createWriteStream(zipPath);
      archive.pipe(writeStream);
      archive.directory(outputDir, false);

      // Wait for the archive to complete
      await new Promise<void>((resolve, reject) => {
        writeStream.on("close", resolve);
        writeStream.on("error", reject);
        archive.finalize();
      });

      return { zipPath, tempDir };
    } catch (error) {
      logger.error("Error processing upload:", error);
      throw error;
    }
  }

  public async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      logger.error("Error cleaning up temp directory:", error);
    }
  }
}
