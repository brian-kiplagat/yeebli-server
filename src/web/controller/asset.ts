import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import type { AssetService } from '../../service/asset.js';
import type { EventService } from '../../service/event.js';
import type { LeadService } from '../../service/lead.js';
import type { UserService } from '../../service/user.js';
import type { AssetQuery, CreateAssetBody, RenameAssetBody } from '../validator/asset.js';
import { ERRORS, serveBadRequest, serveInternalServerError, serveNotFound } from './resp/error.js';
import { serveData } from './resp/resp.ts';

export class AssetController {
  private service: AssetService;
  private userService: UserService;
  private eventService: EventService;
  private leadService: LeadService;

  constructor(
    service: AssetService,
    userService: UserService,
    eventService: EventService,
    leadService: LeadService,
  ) {
    this.service = service;
    this.userService = userService;
    this.eventService = eventService;
    this.leadService = leadService;
  }

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  }

  /**
   * Creates a new asset in the system
   * @param {Context} c - The Hono context containing asset details
   * @returns {Promise<Response>} Response containing created asset information
   * @throws {Error} When asset creation fails
   */
  public createAsset = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: CreateAssetBody = await c.req.json();
      const { fileName, contentType, assetType, fileSize, duration } = body;

      const result = await this.service.createAsset(
        user.id,
        fileName.replace(/[^\w.-]/g, ''),
        contentType,
        assetType,
        fileSize,
        duration,
      );
      return c.json(result, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all assets based on user role and permissions
   * @param {Context} c - The Hono context containing pagination, search, and filter parameters
   * @returns {Promise<Response>} Response containing list of assets
   * @throws {Error} When fetching assets fails
   */
  public getAssets = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const { page, limit, search, asset_type } = c.req.query();
      const query: AssetQuery = {
        page: page ? Number.parseInt(page) : 1,
        limit: limit ? Number.parseInt(limit) : 30,
        search,
        asset_type: asset_type as AssetQuery['asset_type'],
      };

      if (user.role === 'master' || user.role === 'owner') {
        const assets = await this.service.getAllAssets(query);
        return c.json(assets);
      }

      // Get hostId from context and if hostId exists (team access), get resources for that host
      const hostId = c.get('hostId');
      if (hostId) {
        const assets = await this.service.getAssetsByUser(hostId, query);
        return c.json(assets);
      }

      // Regular users only see their own resources
      const assets = await this.service.getAssetsByUser(user.id, query);
      return c.json(assets);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves detailed information about a specific asset
   * @param {Context} c - The Hono context containing asset ID
   * @returns {Promise<Response>} Response containing asset details
   * @throws {Error} When fetching asset details fails
   */
  public getAsset = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const assetId = Number(c.req.param('id'));
      const asset = await this.service.getAsset(assetId);

      if (!asset) {
        return serveNotFound(c, ERRORS.ASSET_NOT_FOUND);
      }

      return c.json(asset);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Deletes an asset if not linked to active events with leads
   * @param {Context} c - The Hono context containing asset ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When asset deletion fails
   */
  public deleteAsset = async (c: Context) => {
    try {
      const assetId = Number(c.req.param('id'));
      const asset = await this.service.getAsset(assetId);

      if (!asset) {
        return serveNotFound(c, ERRORS.ASSET_NOT_FOUND);
      }

      // Check if asset is linked to any events
      const linkedEvent = await this.eventService.findByAssetId(assetId);
      if (linkedEvent) {
        // Check if event has leads, and delete the asset if the event is cancelled, otherwise return an error
        const eventLeads = await this.leadService.findByEventId(linkedEvent.id);
        if (linkedEvent.status === 'cancelled') {
          await this.service.deleteAsset(assetId);
          return serveData(c, { message: 'Asset deleted successfully' });
        }
        if (eventLeads && eventLeads.length > 0) {
          return serveBadRequest(c, ERRORS.ASSET_LINKED_TO_EVENT);
        }
      }

      // If no linked event or no leads, proceed with deletion
      await this.service.deleteAsset(assetId);
      return serveData(c, { message: 'Asset deleted successfully' });
    } catch (error) {
      logger.error('Error deleting asset:', error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Renames an existing asset while preserving file extension
   * @param {Context} c - The Hono context containing new asset name
   * @returns {Promise<Response>} Response indicating rename status
   * @throws {Error} When asset rename fails
   */
  public renameAsset = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const assetId = Number(c.req.param('id'));
      const asset = await this.service.getAsset(assetId);
      if (!asset) {
        return serveNotFound(c, ERRORS.ASSET_NOT_FOUND);
      }
      //only and master role or admin or the owner of the  can update the asset
      if (user.role !== 'master' && user.role !== 'owner' && asset.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body: RenameAssetBody = await c.req.json();
      const { fileName } = body;
      const originalExt = asset.asset_name.split('.').pop()?.toLowerCase();
      const newExt = fileName.split('.').pop()?.toLowerCase();

      if (originalExt !== newExt) {
        return serveBadRequest(c, `New file name must have the same extension: .${originalExt}`);
      }

      await this.service.renameAsset(assetId, fileName);
      return c.json({ message: 'Asset renamed successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
