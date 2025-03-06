import type { AssetRepository } from "../repository/asset.js";
import type { NewAsset } from "../schema/schema.js";
import type { S3Service } from "./s3.js";

export class AssetService {
  private repository: AssetRepository;
  private s3Service: S3Service;

  constructor(repository: AssetRepository, s3Service: S3Service) {
    this.repository = repository;
    this.s3Service = s3Service;
  }

  async createAsset(
    userId: number,
    fileName: string,
    contentType: string,
    assetType: "image" | "video" | "audio" | "document"
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

  async getAssetsByUser(userId: number) {
    return this.repository.findByUserId(userId);
  }

  async getAsset(id: number) {
    return this.repository.find(id);
  }

  async deleteAsset(id: number) {
    return this.repository.delete(id);
  }
}
