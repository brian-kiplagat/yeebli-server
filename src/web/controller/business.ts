import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import type { BusinessService } from '../../service/business.js';
import type { UserService } from '../../service/user.js';
import type { BusinessBody } from '../validator/business.ts';
import { ERRORS, serveBadRequest, serveInternalServerError } from './resp/error.js';

export class BusinessController {
  private service: BusinessService;
  private userService: UserService;

  constructor(service: BusinessService, userService: UserService) {
    this.service = service;
    this.userService = userService;
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
   * Retrieves the business information for the current user
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing business details
   * @throws {Error} When fetching business details fails
   */
  public getMyBusiness = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const business = await this.service.getBusinessByUserId(user.id);
      return c.json({ business });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Creates or updates business information including logo
   * @param {Context} c - The Hono context containing business details
   * @returns {Promise<Response>} Response containing updated business information
   * @throws {Error} When business update fails or logo upload fails
   */
  public upsertBusiness = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: BusinessBody = await c.req.json();
      if (body.imageBase64 && body.fileName) {
        const { imageBase64, fileName } = body;
        const business = await this.service.getBusinessByUserId(user.id);

        if (!business) {
          return serveBadRequest(c, 'Business not found');
        }

        await this.service.updateBusinessLogo(
          business.id,
          imageBase64,
          fileName.replace(/[^\w.-]/g, ''),
        );
      }
      const business = await this.service.upsertBusiness(user.id, {
        ...body,
        user_id: user.id,
      });

      return c.json({
        message: 'Business information saved successfully',
        business,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all businesses (admin only)
   * @param {Context} c - The Hono context containing pagination and search parameters
   * @returns {Promise<Response>} Response containing list of businesses
   * @throws {Error} When fetching businesses fails or user lacks permission
   */
  public getAllBusinesses = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      if (user.role !== 'master' && user.role !== 'owner') {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const { page, limit, search } = c.req.query();
      const query = {
        page: page ? Number.parseInt(page) : 1,
        limit: limit ? Number.parseInt(limit) : 10,
        search,
      };

      const businesses = await this.service.getAllBusinesses(query);
      return c.json(businesses);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
