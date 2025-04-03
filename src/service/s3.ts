import type { Readable } from "stream";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import env from "../lib/env.js";

export class S3Service {
  private client: S3Client;
  private bucket: string;

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

  async initiateMultipartUpload(key: string, contentType: string) {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const response = await this.client.send(command);
    return response.UploadId;
  }

  async generatePresignedUrlForPart(
    key: string,
    uploadId: string,
    partNumber: number
  ) {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: 7200, // 2 hours
    });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[]
  ) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    await this.client.send(command);
    return `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });

    await this.client.send(command);
  }

  async generatePresignedUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(this.client, command, {
      expiresIn: 7200, // 2 hours
    });

    return {
      presignedUrl,
      url: `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
    };
  }

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

  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async copyObject(sourceKey: string, destinationKey: string) {
    const encodedSourceKey = encodeURIComponent(sourceKey);
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${encodedSourceKey}`,
      Key: destinationKey,
    });

    await this.client.send(command);
  }

  async uploadFile(
    key: string,
    content: string | Buffer | Readable,
    contentType: string
  ) {
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
