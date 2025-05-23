import { logger } from '../lib/logger.js';
import type { BusinessRepository } from '../repository/business.js';
import { getContentType } from '../util/string.ts';
import type { BusinessBody, BusinessQuery } from '../web/validator/business.ts';
import type { AssetService } from './asset.js';
import type { S3Service } from './s3.js';
import type { TeamService } from './team.ts';

/**
 * Service class for managing business profiles and related operations
 */
export class BusinessService {
  private repository: BusinessRepository;
  private s3Service: S3Service;
  private assetService: AssetService;
  private teamService: TeamService;

  constructor(
    repository: BusinessRepository,
    s3Service: S3Service,
    assetService: AssetService,
    teamService: TeamService,
  ) {
    this.repository = repository;
    this.s3Service = s3Service;
    this.assetService = assetService;
    this.teamService = teamService;
  }

  /**
   * Handles the upload of a business logo
   * @private
   * @param {number} userId - ID of the user
   * @param {string} logoBase64 - Base64 encoded logo image
   * @param {string} fileName - Name of the logo file
   * @returns {Promise<{assetId: number}>} Created asset ID
   * @throws {Error} When logo upload fails
   */
  private async handleLogoUpload(userId: number, logoBase64: string, fileName: string) {
    try {
      // Remove the data:image/xyz;base64, prefix
      const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const contentType = getContentType(logoBase64);

      // Let AssetService handle the upload and path generation
      const assetObject = await this.assetService.createAsset(
        userId,
        fileName,
        contentType,
        'profile_picture',
        buffer.length,
        0,
        buffer,
      );

      return { assetId: assetObject.asset };
    } catch (error) {
      logger.error('Failed to upload logo:', error);
      throw error;
    }
  }

  /**
   * Retrieves business details including logo for a specific user
   * @param {number} userId - ID of the user
   * @returns {Promise<Business>} Business details with resolved logo URL
   */
  public async getBusinessDetailsByUserId(userId: number) {
    const business = await this.repository.findByUserId(userId);
    if (!business?.logo_asset_id) return { ...business, logo: null };

    // Get the asset and its URL
    const asset = await this.assetService.getAsset(business.logo_asset_id);

    if (!asset || !asset.asset_url) return { ...business, logo: null };

    return {
      ...business,
      logo: asset.asset_url,
    };
  }

  /**
   * Retrieves business information with team details for a specific user
   * @param {number} userId - ID of the user
   * @returns {Promise<Business>} Business details with team information
   * @throws {Error} When business retrieval fails
   */
  public async getBusinessByUserId(userId: number) {
    try {
      const business = await this.repository.findByUserId(userId);
      if (!business?.logo_asset_id) return business;

      // Get the asset and its URL
      const asset = await this.assetService.getAsset(business.logo_asset_id);
      if (!asset || !asset.asset_url) return business;

      // Get the team where user is host
      const team = await this.teamService.getTeamByHostId(userId);
      return {
        ...business,
        logo: asset.asset_url,
        teamDetails: {
          ...team,
          user: { email: team?.user?.email, name: team?.user?.name },
        },
      };
    } catch (error) {
      logger.error('Failed to get business by user:', error);
      throw error;
    }
  }

  /**
   * Retrieves all businesses with optional filtering
   * @param {BusinessQuery} [query] - Query parameters for filtering businesses
   * @returns {Promise<{businesses: Business[], total: number}>} List of businesses and total count
   * @throws {Error} When business retrieval fails
   */
  public async getAllBusinesses(query?: BusinessQuery) {
    try {
      return await this.repository.findAll(query);
    } catch (error) {
      logger.error('Failed to get all businesses:', error);
      throw error;
    }
  }

  /**
   * Creates or updates a business profile
   * @param {number} userId - ID of the user
   * @param {BusinessBody} business - Business details to create/update
   * @returns {Promise<Business>} Updated business information
   * @throws {Error} When business creation/update fails
   */
  public async upsertBusiness(userId: number, business: BusinessBody) {
    try {
      const existingBusiness = await this.repository.findByUserId(userId);

      // Start with existing logo_asset_id if it exists
      let logoAssetId = existingBusiness?.logo_asset_id || null;

      if (business.logo) {
        if (business.logo.startsWith('data:image')) {
          // Handle logo upload if it's a base64 string
          const fileName = business.logoFileName || `business-logo-${userId}.jpg`;
          const logoData = await this.handleLogoUpload(userId, business.logo, fileName);
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

      if (existingBusiness) {
        // Update existing business
        await this.repository.update(existingBusiness.id, businessData);
      } else {
        // Create business and team in parallel
        await Promise.all([
          this.repository.create(businessData),
          this.teamService.createTeam(business.name, userId),
        ]);
      }

      // Return business with resolved asset URLs
      return await this.getBusinessByUserId(userId);
    } catch (error) {
      logger.error('Failed to upsert business:', error);
      throw error;
    }
  }

  /**
   * Retrieves business logo information
   * @param {number} businessId - ID of the business
   * @returns {Promise<{logo: string|null, presignedLogoUrl: string|null}>} Logo URLs
   * @throws {Error} When logo retrieval fails
   */
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
      logger.error('Failed to get business logo:', error);
      throw error;
    }
  }

  /**
   * Updates business logo with a new image
   * @param {number} businessId - ID of the business
   * @param {string} imageBase64 - Base64 encoded logo image
   * @param {string} fileName - Name of the logo file
   * @returns {Promise<{success: boolean, message: string, business: Business}>} Updated business information
   * @throws {Error} When logo update fails
   */
  public updateBusinessLogo = async (businessId: number, imageBase64: string, fileName: string) => {
    try {
      // Convert base64 to buffer
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Create asset using AssetService
      const { asset: assetId } = await this.assetService.createAsset(
        businessId,
        fileName,
        getContentType(imageBase64),
        'profile_picture',
        buffer.length,
        0,
        buffer,
      );

      // Update business with just the asset ID
      await this.repository.update(businessId, {
        logo_asset_id: assetId,
      });

      // Get the updated business with presigned URL
      const business = await this.repository.findById(businessId);
      if (!business) {
        throw new Error('Business not found after update');
      }

      const asset = await this.assetService.getAsset(assetId);
      if (!asset?.asset_url) {
        throw new Error('Failed to get asset URL');
      }

      return {
        success: true,
        message: 'Business logo uploaded successfully',
        business: {
          ...business,
          logo: asset.asset_url,
        },
      };
    } catch (error) {
      logger.error('Error uploading business logo:', error);
      throw error;
    }
  };
}
