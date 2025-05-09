import { and, desc, eq, like } from 'drizzle-orm';

import { db } from '../lib/database.js';
import type { AssetRepository } from '../repository/asset.js';
import type { Asset, NewAsset } from '../schema/schema.js';
import { assetsSchema } from '../schema/schema.js';
import type { AssetQuery } from '../web/validator/asset.js';
import type { S3Service } from './s3.js';

/**
 * Service class for managing digital assets (images, videos, audio, documents)
 */
export class AssetService {
  private repository: AssetRepository;
  private s3Service: S3Service;

  constructor(repository: AssetRepository, s3Service: S3Service) {
    this.repository = repository;
    this.s3Service = s3Service;
  }

  /**
   * Creates a new asset and uploads it to S3 if buffer is provided
   * @param {number} userId - ID of the user creating the asset
   * @param {string} fileName - Name of the file
   * @param {string} contentType - MIME type of the file
   * @param {'image'|'video'|'audio'|'document'|'profile_picture'} assetType - Type of asset
   * @param {number} fileSize - Size of the file in bytes
   * @param {number} duration - Duration in seconds (for audio/video)
   * @param {Buffer} [buffer] - Optional file buffer for direct upload
   * @returns {Promise<{presignedUrl: string, asset: Asset}>} Created asset and upload URL
   */
  async createAsset(
    userId: number,
    fileName: string,
    contentType: string,
    assetType: 'image' | 'video' | 'audio' | 'document' | 'profile_picture',
    fileSize: number,
    duration: number,
    buffer?: Buffer,
  ) {
    // Generate a unique key for the file with consistent folder structure
    const key = `assets/${assetType}s/${Date.now()}-${fileName.replace(/[^\w.-]/g, '')}`;

    let url: string;
    let presignedUrl: string;
    if (buffer) {
      // If buffer is provided, upload the file
      url = await this.s3Service.uploadFile(key, buffer, contentType);
      presignedUrl = url;
    } else {
      // Otherwise, just generate a presigned URL for client upload
      const result = await this.s3Service.generatePresignedUrl(key, contentType);
      url = result.url; // Store the permanent URL in the database
      presignedUrl = result.presignedUrl;
    }

    // Create asset record in database
    const asset: NewAsset = {
      asset_name: fileName.replace(/[^\w.-]/g, ''),
      asset_size: fileSize,
      asset_type: assetType,
      content_type: contentType,
      asset_url: url,
      user_id: userId,
      duration: duration,
    };

    const createdAsset = await this.repository.create(asset);

    return {
      presignedUrl,
      asset: createdAsset,
    };
  }

  /**
   * Retrieves all assets for a specific user with presigned URLs
   * @param {number} userId - ID of the user
   * @param {AssetQuery} [query] - Query parameters for filtering assets
   * @returns {Promise<{assets: Asset[], total: number}>} List of assets and total count
   */
  async getAssetsByUser(userId: number, query?: AssetQuery) {
    const { assets, total } = await this.repository.findByUserId(userId, query);

    // Add presigned URLs to all assets
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        if (!asset.asset_url) return asset;

        const presignedUrl = await this.s3Service.generateGetUrl(
          this.getKeyFromUrl(asset.asset_url),
          this.getContentType(asset),
          86400,
        );

        return {
          ...asset,
          presignedUrl,
        };
      }),
    );

    return { assets: assetsWithUrls, total };
  }

  /**
   * Retrieves a single asset by ID with presigned URL
   * @param {number} id - ID of the asset
   * @returns {Promise<Asset|undefined>} Asset if found, undefined otherwise
   */
  async getAsset(id: number) {
    const asset = await this.repository.find(id);
    if (!asset || !asset.asset_url) return undefined;

    const presignedUrl = await this.s3Service.generateGetUrl(
      this.getKeyFromUrl(asset.asset_url),
      this.getContentType(asset),
      86400,
    );

    return {
      ...asset,
      presignedUrl,
    };
  }

  /**
   * Deletes an asset from both S3 and database
   * @param {number} id - ID of the asset to delete
   * @returns {Promise<void>}
   */
  async deleteAsset(id: number) {
    const asset = await this.repository.find(id);
    if (!asset || !asset.asset_url) return;

    // Delete from S3 first
    await this.s3Service.deleteObject(this.getKeyFromUrl(asset.asset_url));

    // Then delete from database
    await this.repository.delete(id);
  }

  /**
   * Renames an existing asset
   * @param {number} id - ID of the asset
   * @param {string} newFileName - New name for the asset
   * @returns {Promise<void>}
   */
  async renameAsset(id: number, newFileName: string) {
    const asset = await this.repository.find(id);
    if (!asset) return;

    // Update database
    await this.repository.update(id, {
      asset_name: newFileName,
    });
  }

  /**
   * Updates asset properties
   * @param {number} id - ID of the asset
   * @param {Partial<Asset>} update - Properties to update
   * @returns {Promise<void>}
   */
  async updateAsset(id: number, update: Partial<Asset>) {
    await this.repository.update(id, update);
  }

  /**
   * Finds all unprocessed video assets
   * @returns {Promise<Asset[]>} List of unprocessed video assets
   */
  async findUnprocessedVideos() {
    const { assets } = await this.repository.findByQuery({
      asset_type: 'video',
      processing_status: 'pending',
    });

    return assets.filter((asset) => asset.asset_url); // Only return assets that have been uploaded
  }

  /**
   * Retrieves all assets with pagination and filtering
   * @param {AssetQuery} [query] - Query parameters for filtering assets
   * @returns {Promise<{assets: Asset[], total: number}>} List of assets and total count
   */
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
          86400,
        );

        return {
          ...asset,
          presignedUrl,
        };
      }),
    );

    return { assets: assetsWithUrls, total: total.length };
  }

  /**
   * Determines content type for an asset
   * @private
   * @param {Asset} asset - The asset to determine content type for
   * @returns {string} The content type
   */
  private getContentType(asset: Asset): string {
    if (asset.content_type) {
      return asset.content_type;
    }

    // Fallback to determining from asset type if content_type is not stored
    switch (asset.asset_type) {
      case 'image':
        return 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'audio':
        return 'audio/mpeg';
      case 'document':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  public getKeyFromUrl(url: string): string {
    const urlParts = url.split('.amazonaws.com/');
    return urlParts[1] || '';
  }
}
