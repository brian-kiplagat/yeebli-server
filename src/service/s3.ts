import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';

import env from '../lib/env.js';

/**
 * Service class for managing AWS S3 operations including file uploads, downloads, and URL generation
 */
export class S3Service {
  private client: S3Client;
  private bucket: string;

  /**
   * Creates an instance of S3Service
   * Initializes AWS S3 client with credentials from environment variables
   */
  constructor() {
    this.client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });
    this.bucket = env.S3_BUCKET_NAME;
  }

  /**
   * Generates a presigned URL for uploading a file to S3
   * @param {string} key - The S3 object key (file path)
   * @param {string} contentType - MIME type of the file
   * @returns {Promise<{presignedUrl: string, url: string}>} Presigned URL for upload and final S3 URL
   */
  async generatePresignedUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(this.client, command, {
      expiresIn: 3600, // URL expires in 1 hour
    });

    return {
      presignedUrl,
      url: `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
    };
  }

  /**
   * Generates a presigned URL for downloading/viewing a file from S3
   * @param {string} key - The S3 object key (file path)
   * @param {string} contentType - MIME type of the file
   * @param {number} [expiresIn=3600] - URL expiration time in seconds
   * @returns {Promise<string>} Presigned URL for downloading/viewing
   */
  async generateGetUrl(key: string, contentType: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn,
    });
  }

  /**
   * Deletes an object from S3
   * @param {string} key - The S3 object key (file path) to delete
   * @returns {Promise<void>}
   */
  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Copies an object within the same S3 bucket
   * @param {string} sourceKey - The source object key
   * @param {string} destinationKey - The destination object key
   * @returns {Promise<void>}
   */
  async copyObject(sourceKey: string, destinationKey: string) {
    const encodedSourceKey = encodeURIComponent(sourceKey);
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${encodedSourceKey}`,
      Key: destinationKey,
    });

    await this.client.send(command);
  }

  /**
   * Uploads a file directly to S3
   * @param {string} key - The S3 object key (file path)
   * @param {string|Buffer|Readable} content - The file content to upload
   * @param {string} contentType - MIME type of the file
   * @returns {Promise<string>} The URL of the uploaded file
   */
  async uploadFile(key: string, content: string | Buffer | Readable, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    });

    await this.client.send(command);
    return `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }
}
