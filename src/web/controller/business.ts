import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { BusinessService } from "../../service/business.js";
import type { UserService } from "../../service/user.js";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
 
} from "./resp/error.js";
import { BusinessBody } from "../validator/business.ts";

export class BusinessController {
  private service: BusinessService;
  private userService: UserService;

  constructor(service: BusinessService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

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
          return serveBadRequest(c, "Business not found");
        }

        await this.service.updateBusinessLogo(
          business.id,
          imageBase64,
          fileName
        );
      }
      const business = await this.service.upsertBusiness(user.id, {
        ...body,
        user_id: user.id,
      });

      return c.json({
        message: "Business information saved successfully",
        business,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getAllBusinesses = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      if (user.role !== "master" && user.role !== "owner") {
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
