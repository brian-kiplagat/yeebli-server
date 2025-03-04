import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import env from "../lib/env.js";

export class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucket = env.AWS_S3_BUCKET;
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
}
