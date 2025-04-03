import { and, desc, eq, like } from "drizzle-orm";
import { db } from "../lib/database.js";
import { AssetRepository } from "../repository/asset.js";
import type { Asset, NewAsset } from "../schema/schema.js";
import { assetsSchema } from "../schema/schema.js";
import type { AssetQuery } from "../web/validator/asset.js";
import { S3Service } from "./s3.js";
import env from "../lib/env.js";

type AssetType = "image" | "video" | "audio" | "document";

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
}

export class AssetService {
  private repository: AssetRepository;
  private s3Service: S3Service;

  constructor() {
    this.repository = new AssetRepository();
    this.s3Service = new S3Service();
  }

  async createAsset(
    file: MulterFile,
    userId: string,
    assetType: AssetType,
    duration?: number
  ) {
    const key = `assets/${assetType}s/${Date.now()}-${file.originalname}`;
    const contentType = file.mimetype || "application/octet-stream";

    // For files larger than 5MB, use multipart upload
    if (file.size > 5 * 1024 * 1024) {
      const uploadId = await this.s3Service.initiateMultipartUpload(
        key,
        contentType
      );
      if (!uploadId) throw new Error("Failed to initiate multipart upload");

      // Calculate number of parts (5MB each)
      const partSize = 5 * 1024 * 1024;
      const totalParts = Math.ceil(file.size / partSize);

      // Generate presigned URLs for each part
      const partUrls = await Promise.all(
        Array.from({ length: totalParts }, (_, i) =>
          this.s3Service.generatePresignedUrlForPart(key, uploadId, i + 1)
        )
      );

      return {
        presignedUrls: partUrls,
        uploadId,
        key,
        totalParts,
        partSize,
        asset: await this.repository.create({
          asset_name: file.originalname,
          asset_size: file.size,
          asset_type: assetType,
          content_type: contentType,
          asset_url: `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
          user_id: parseInt(userId),
          duration: duration || 0,
        }),
      };
    }

    // For smaller files, use single part upload
    const { presignedUrl, url } = await this.s3Service.generatePresignedUrl(
      key,
      contentType
    );

    const asset = await this.repository.create({
      asset_name: file.originalname,
      asset_size: file.size,
      asset_type: assetType,
      content_type: contentType,
      asset_url: url,
      user_id: parseInt(userId),
      duration: duration || 0,
    });

    return { presignedUrl, asset };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[]
  ) {
    return this.s3Service.completeMultipartUpload(key, uploadId, parts);
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    return this.s3Service.abortMultipartUpload(key, uploadId);
  }

  async getAssetsByUser(userId: number, query?: AssetQuery) {
    const { assets, total } = await this.repository.findByUserId(userId, query);

    // Add presigned URLs to all assets
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        if (!asset.asset_url) return asset;

        const presignedUrl = await this.s3Service.generateGetUrl(
          this.getKeyFromUrl(asset.asset_url),
          this.getContentType(asset),
          86400
        );

        return {
          ...asset,
          presignedUrl,
        };
      })
    );

    return { assets: assetsWithUrls, total };
  }

  async getAsset(id: number) {
    const asset = await this.repository.find(id);
    if (!asset || !asset.asset_url) return undefined;

    const presignedUrl = await this.s3Service.generateGetUrl(
      this.getKeyFromUrl(asset.asset_url),
      this.getContentType(asset),
      86400
    );

    return {
      ...asset,
      presignedUrl,
    };
  }

  async deleteAsset(id: number) {
    const asset = await this.repository.find(id);
    if (!asset || !asset.asset_url) return;

    // Delete from S3 first
    await this.s3Service.deleteObject(this.getKeyFromUrl(asset.asset_url));

    // Then delete from database
    await this.repository.delete(id);
  }

  async renameAsset(id: number, newFileName: string) {
    const asset = await this.repository.find(id);
    if (!asset) return;

    // Update database
    await this.repository.update(id, {
      asset_name: newFileName,
    });
  }

  async updateAsset(id: number, update: Partial<Asset>) {
    await this.repository.update(id, update);
  }

  async findUnprocessedVideos() {
    const { assets } = await this.repository.findByQuery({
      asset_type: "video",
      processing_status: "pending",
    });

    return assets.filter((asset) => asset.asset_url); // Only return assets that have been uploaded
  }

  async getAllAssets(query?: AssetQuery) {
    const { page = 1, limit = 10, search, asset_type } = query || {};
    const offset = (page - 1) * limit;

    const whereConditions = [];
    if (search) {
      whereConditions.push(like(assetsSchema.asset_name, `%${search}%`));
    }
    if (asset_type) {
      whereConditions.push(eq(assetsSchema.asset_type, asset_type));
    }

    const assets = await db
      .select()
      .from(assetsSchema)
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(assetsSchema.created_at));

    const total = await db
      .select({ count: assetsSchema.id })
      .from(assetsSchema)
      .where(whereConditions.length ? and(...whereConditions) : undefined);

    // Add presigned URLs to all assets
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset: Asset) => {
        if (!asset.asset_url) return asset;

        const presignedUrl = await this.s3Service.generateGetUrl(
          this.getKeyFromUrl(asset.asset_url),
          this.getContentType(asset),
          86400
        );

        return {
          ...asset,
          presignedUrl,
        };
      })
    );

    return { assets: assetsWithUrls, total: total.length };
  }

  private getContentType(asset: Asset): string {
    if (asset.content_type) {
      return asset.content_type;
    }

    // Fallback to determining from asset type if content_type is not stored
    switch (asset.asset_type) {
      case "image":
        return "image/jpeg";
      case "video":
        return "video/mp4";
      case "audio":
        return "audio/mpeg";
      case "document":
        return "application/pdf";
      default:
        return "application/octet-stream";
    }
  }

  public getKeyFromUrl(url: string): string {
    const urlParts = url.split(".amazonaws.com/");
    return urlParts[1] || "";
  }
}
