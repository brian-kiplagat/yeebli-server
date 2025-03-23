import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { join } from 'path';
import { promisify } from 'util';
import { Queue } from 'bullmq';
import { mkdir, rm, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { connection } from '../lib/queue.js';
import type { Resolution } from '../web/validator/hls.ts';
import type { AssetService } from './asset.js';
import type { S3Service } from './s3.js';
const execAsync = promisify(exec);

export class HLSService {
  private s3Service: S3Service;
  private assetService: AssetService;

  constructor(s3Service: S3Service, assetService: AssetService) {
    this.s3Service = s3Service;
    this.assetService = assetService;
  }

  public async processUpload(file: File, allowList: Resolution[]): Promise<{ hlsUrl: string }> {
    const tempDir = join(process.cwd(), 'temp', uuidv4());
    const outputDir = join(tempDir, 'output');

    try {
      // Create directories in parallel
      await Promise.all([mkdir(tempDir, { recursive: true }), mkdir(outputDir, { recursive: true })]);

      // Save uploaded file
      const buffer = Buffer.from(await file.arrayBuffer());
      const inputPath = join(tempDir, file.name);
      await writeFile(inputPath, buffer);

      const resolutions = {
        '1080p': {
          width: 1920,
          height: 1080,
          bitrate: 5000,
          maxrate: 5350,
          bufsize: 7500,
        },
        '720p': {
          width: 1280,
          height: 720,
          bitrate: 2800,
          maxrate: 2996,
          bufsize: 4200,
        },
        '480p': {
          width: 854,
          height: 480,
          bitrate: 1400,
          maxrate: 1498,
          bufsize: 2100,
        },
        '360p': {
          width: 640,
          height: 360,
          bitrate: 800,
          maxrate: 900,
          bufsize: 1200,
        },
      };

      // Generate filter_complex dynamically
      const videoFilters = allowList
        .map((res, index) => `[v${index}]scale=w=${resolutions[res].width}:h=${resolutions[res].height}[v${index}out]`)
        .join('; ');

      // Generate -map and encoding settings dynamically
      const videoMaps = allowList
        .map(
          (res, index) =>
            `-map "[v${index}out]" -c:v:${index} libx264 -b:v:${index} ${resolutions[res].bitrate}k ` +
            `-maxrate:v:${index} ${resolutions[res].maxrate}k -bufsize:v:${index} ${resolutions[res].bufsize}k -preset ultrafast`,
        )
        .join(' ');

      const audioMaps = allowList.map((_, index) => `-map a:0? -c:a aac -b:a:${index} 128k -ac 2`).join(' ');

      const streamMap = allowList.map((_, index) => `v:${index},a:${index}`).join(' ');

      // Construct FFmpeg command dynamically
      const ffmpegCommand = `ffmpeg -i "${inputPath}" \
  -filter_complex "[0:v]split=${allowList.length}${allowList.map((_, i) => `[v${i}]`).join('')}; ${videoFilters}" \
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

      // Generate a unique key for the HLS files
      const key = uuidv4();
      const s3BasePath = `assets/hls/${key}`;

      // Upload master playlist
      const masterContent = await fs.readFile(join(outputDir, 'master.m3u8'), 'utf8');
      await this.s3Service.uploadFile(`${s3BasePath}/master.m3u8`, masterContent, 'application/x-mpegURL');

      // Upload variant playlists and segments
      const uploadPromises: Promise<any>[] = [];

      for (let i = 0; i < allowList.length; i++) {
        const streamDir = join(outputDir, `stream_${i}`);
        const files = await fs.readdir(streamDir);

        for (const file of files) {
          const filePath = join(streamDir, file);
          const s3Key = `${s3BasePath}/stream_${i}/${file}`;
          const contentType = file.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T';

          if (file.endsWith('.m3u8')) {
            // For playlist files, read the content first
            const content = await fs.readFile(filePath, 'utf8');
            uploadPromises.push(this.s3Service.uploadFile(s3Key, content, contentType));
          } else {
            // For video segments, use streaming upload
            uploadPromises.push(this.s3Service.uploadFile(s3Key, createReadStream(filePath), contentType));
          }
        }
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Generate HLS URL
      const hlsUrl = `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${s3BasePath}/master.m3u8`;

      // Cleanup temporary files in the background
      rm(tempDir, { recursive: true, force: true }).catch((error) => {
        logger.error('Failed to cleanup temp directory:', error);
      });

      return { hlsUrl };
    } catch (error) {
      logger.error('Error processing upload:', error);
      throw error;
    }
  }
}
