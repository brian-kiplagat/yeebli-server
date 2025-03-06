import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
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

  async generateGetUrl(key: string, contentType: string, expiresIn: number = 3600) {
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
}
