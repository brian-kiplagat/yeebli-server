import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { PricePlanService } from "../../service/pricePlan.js";
import type { UserService } from "../../service/user.js";
import type {
  CreatePricePlanBody,
  UpdatePricePlanBody,
} from "../validator/pricePlan.ts";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.js";

export class PricePlanController {
  private service: PricePlanService;
  private userService: UserService;

  constructor(service: PricePlanService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public getPricePlans = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const { page, limit, search } = c.req.query();
      const query = {
        page: page ? Number.parseInt(page) : undefined,
        limit: limit ? Number.parseInt(limit) : undefined,
        search,
      };

      // Admin users (master/owner) can see all price plans
      if (user.role === "master" || user.role === "owner") {
        const plans = await this.service.getAllPricePlans(query);
        return c.json(plans);
      }

      // Regular users only see their own price plans
      const plans = await this.service.getPricePlansByUser(user.id, query);
      return c.json(plans);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getPricePlan = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Only master and owner roles can view price plans
      if (user.role !== "master" && user.role !== "owner") {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const planId = Number(c.req.param("id"));
      const plan = await this.service.getPricePlan(planId);

      if (!plan) {
        return serveNotFound(c, ERRORS.PRICE_PLAN_NOT_FOUND);
      }

      return c.json(plan);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public createPricePlan = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Only master and owner roles can create price plans
      if (user.role !== "master" && user.role !== "owner") {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body: CreatePricePlanBody = await c.req.json();
      const planId = await this.service.createPricePlan({
        ...body,
        user_id: user.id,
      });

      return c.json(
        {
          message: "Price plan created successfully",
          planId: planId,
        },
        201
      );
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updatePricePlan = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Only master and owner roles can update price plans
      if (user.role !== "master" && user.role !== "owner") {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const planId = Number(c.req.param("id"));
      const plan = await this.service.getPricePlan(planId);

      if (!plan) {
        return serveBadRequest(c, ERRORS.PRICE_PLAN_NOT_FOUND);
      }

      const body: UpdatePricePlanBody = await c.req.json();
      await this.service.updatePricePlan(planId, body);

      return c.json({ message: "Price plan updated successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deletePricePlan = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Only master and owner roles can delete price plans
      if (user.role !== "master" && user.role !== "owner") {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const planId = Number(c.req.param("id"));
      const plan = await this.service.getPricePlan(planId);

      if (!plan) {
        return serveNotFound(c, ERRORS.PRICE_PLAN_NOT_FOUND);
      }

      await this.service.deletePricePlan(planId);
      return c.json({ message: "Price plan deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
