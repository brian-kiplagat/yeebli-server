import type { Context } from "hono";
import { logger } from "../../lib/logger.ts";

import type { UserService } from "../../service/user.ts";

import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.ts";
import { MembershipService } from "../../service/membership.ts";
import {
  CreateMembershipBody,
  UpdateMembershipBody,
} from "../validator/membership.ts";

export class MembershipController {
  private service: MembershipService;
  private userService: UserService;

  constructor(service: MembershipService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public getMemberships = async (c: Context) => {
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

      // Admin users (master/owner) can see all memberships
      if (user.role === "master" || user.role === "owner") {
        const plans = await this.service.getAllMemberships(query);
        return c.json(plans);
      }

      // Regular users only see their own memberships
      const plans = await this.service.getMembershipsByUser(user.id, query);
      return c.json(plans);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getMembership = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Only master and owner roles can view memberships
      if (user.role !== "master" && user.role !== "owner") {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const planId = Number(c.req.param("id"));
      const plan = await this.service.getMembership(planId);

      if (!plan) {
        return serveNotFound(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }

      return c.json(plan);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public createMembership = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Only master and owner roles can create memberships
      if (user.role !== "master" && user.role !== "owner") {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body: CreateMembershipBody = await c.req.json();
      const planId = await this.service.createMembership({
        ...body,
        user_id: user.id,
      });

      return c.json(
        {
          message: "Membership created successfully",
          planId: planId,
        },
        201
      );
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updateMembership = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Only master and owner roles can update memberships
      if (user.role !== "master" && user.role !== "owner") {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const planId = Number(c.req.param("id"));
      const plan = await this.service.getMembership(planId);

      if (!plan) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }

      const body: UpdateMembershipBody = await c.req.json();
      await this.service.updateMembership(planId, body);

      return c.json({ message: "Membership updated successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteMembership = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Only master and owner roles can delete memberships
      if (user.role !== "master" && user.role !== "owner") {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const planId = Number(c.req.param("id"));
      const plan = await this.service.getMembership(planId);

      if (!plan) {
        return serveNotFound(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }

      await this.service.deleteMembership(planId);
      return c.json({ message: "Membership deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
