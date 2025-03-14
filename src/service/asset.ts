import type { AssetRepository } from "../repository/asset.js";
import type { NewAsset, Asset } from "../schema/schema.js";
import type { S3Service } from "./s3.js";
import type { AssetQuery } from "../web/validator/asset.js";

export class AssetService {
  private repository: AssetRepository;
  s3Service: S3Service;

  constructor(repository: AssetRepository, s3Service: S3Service) {
    this.repository = repository;
    this.s3Service = s3Service;
  }

  async createAsset(
    userId: number,
    fileName: string,
    contentType: string,
    assetType: "image" | "video" | "audio" | "document",
    fileSize: number
  ) {
    // Generate a unique key for the file
    const key = `assets/${assetType}/${Date.now()}-${fileName}`;

    // Get presigned URL from S3
    const { presignedUrl, url } = await this.s3Service.generatePresignedUrl(
      key,
      contentType
    );

    // Create asset record in database
    const asset: NewAsset = {
      asset_name: fileName,
      asset_size: fileSize,
      asset_type: assetType,
      asset_url: url,
      user_id: userId,
    };

    await this.repository.create(asset);

    return {
      presignedUrl,
      asset,
    };
  }

  async getAssetsByUser(userId: number, query?: AssetQuery) {
    const { assets, total } = await this.repository.findByUserId(userId, query);

    // Add presigned URLs to all assets
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        if (!asset.asset_url) return asset;

        const presignedUrl = await this.s3Service.generateGetUrl(
          this.getKeyFromUrl(asset.asset_url),
          this.getContentType(asset.asset_type as string),
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
      this.getContentType(asset.asset_type as string),
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
    if (!asset || !asset.asset_url) return;

    // Get the old key and generate new key with same timestamp but new filename
    const oldKey = this.getKeyFromUrl(asset.asset_url);
    const [prefix, timestamp] = oldKey.split("-");
    const newKey = `${prefix}-${Date.now()}-${newFileName}`;

    // Copy the object with new key
    await this.s3Service.copyObject(oldKey, newKey);

    // Delete the old object
    await this.s3Service.deleteObject(oldKey);

    // Get the new URL
    const newUrl = asset.asset_url.replace(oldKey, newKey);

    // Update database
    await this.repository.update(id, {
      asset_name: newFileName,
      asset_url: newUrl,
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

  async findAll() {
    const { assets } = await this.repository.findByQuery({});
    return assets;
  }

  getContentType(assetType: string): string {
    switch (assetType) {
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

  getKeyFromUrl(url: string): string {
    const urlParts = url.split(".amazonaws.com/");
    return urlParts[1] || "";
  }
}
