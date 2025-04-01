import { logger } from "../lib/logger.js";
import type { BusinessRepository } from "../repository/business.js";
import { NewBusiness } from "../schema/schema.ts";
import type { BusinessQuery, BusinessBody } from "../web/validator/business.ts";
import type { S3Service } from "./s3.js";
import type { AssetService } from "./asset.js";

export class BusinessService {
  private repository: BusinessRepository;
  private s3Service: S3Service;
  private assetService: AssetService;

  constructor(
    repository: BusinessRepository,
    s3Service: S3Service,
    assetService: AssetService
  ) {
    this.repository = repository;
    this.s3Service = s3Service;
    this.assetService = assetService;
  }

  private getContentType(logo: string): string {
    if (logo.startsWith("data:image/")) {
      // Extract content type from base64 string
      const match = logo.match(/^data:image\/(\w+);base64,/);
      return match ? `image/${match[1]}` : "image/jpeg";
    }
    // For URLs, try to determine from extension
    const extension = logo.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      default:
        return "image/jpeg";
    }
  }

  private async handleLogoUpload(
    userId: number,
    logoBase64: string,
    fileName: string
  ) {
    try {
      // Remove the data:image/xyz;base64, prefix
      const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const contentType = this.getContentType(logoBase64);

      // Generate a unique key for S3 using the consistent path structure
      const key = `assets/images/${Date.now()}-${fileName}`;

      // Upload to S3
      const url = await this.s3Service.uploadFile(key, buffer, contentType);

      // Create asset record with content type
      const assetObject = await this.assetService.createAsset(
        userId,
        fileName,
        contentType,
        "image",
        buffer.length,
        0
      );

      return { assetId: assetObject.asset };
    } catch (error) {
      logger.error("Failed to upload logo:", error);
      throw error;
    }
  }

  public async getBusinessByUserId(userId: number) {
    try {
      const business = await this.repository.findByUserId(userId);
      if (!business?.logo_asset_id) return business;

      // Get the asset and its presigned URL
      const asset = await this.assetService.getAsset(business.logo_asset_id);
      if (!asset) return business;

      return {
        ...business,
        logo: asset.asset_url,
        presignedLogoUrl: asset.presignedUrl,
      };
    } catch (error) {
      logger.error("Failed to get business by user:", error);
      throw error;
    }
  }

  public async getAllBusinesses(query?: BusinessQuery) {
    try {
      return await this.repository.findAll(query);
    } catch (error) {
      logger.error("Failed to get all businesses:", error);
      throw error;
    }
  }

  public async upsertBusiness(userId: number, business: BusinessBody) {
    try {
      const existingBusiness = await this.repository.findByUserId(userId);

      // Start with existing logo_asset_id if it exists
      let logoAssetId = existingBusiness?.logo_asset_id || null;

      if (business.logo) {
        if (business.logo.startsWith("data:image")) {
          // Handle logo upload if it's a base64 string
          const fileName =
            business.logoFileName || `business-logo-${userId}.jpg`;
          const logoData = await this.handleLogoUpload(
            userId,
            business.logo,
            fileName
          );
          logoAssetId = logoData.assetId;
        } else {
          // If logo is not a base64 string and not updating, keep existing logo_asset_id
          logoAssetId = existingBusiness?.logo_asset_id;
        }
      }

      const businessData = {
        ...business,
        logo_asset_id: logoAssetId,
        user_id: userId,
      };

      let updatedBusiness;
      if (existingBusiness) {
        // Update existing business
        updatedBusiness = await this.repository.update(
          existingBusiness.id,
          businessData
        );
      } else {
        // Create new business
        updatedBusiness = await this.repository.create(businessData);
      }

      // Return business with resolved asset URLs
      return await this.getBusinessByUserId(userId);
    } catch (error) {
      logger.error("Failed to upsert business:", error);
      throw error;
    }
  }

  public async getBusinessLogo(businessId: number) {
    try {
      const business = await this.repository.findById(businessId);
      if (!business?.logo_asset_id) {
        return { logo: null, presignedLogoUrl: null };
      }

      const asset = await this.assetService.getAsset(business.logo_asset_id);
      if (!asset) {
        return { logo: null, presignedLogoUrl: null };
      }

      return {
        logo: asset.asset_url,
        presignedLogoUrl: asset.presignedUrl,
      };
    } catch (error) {
      logger.error("Failed to get business logo:", error);
      throw error;
    }
  }
}
