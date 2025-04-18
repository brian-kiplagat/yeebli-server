import type { Context } from "hono";
import { logger } from "../../lib/logger.ts";

import type { UserService } from "../../service/user.ts";

import type { MembershipService } from "../../service/membership.ts";
import type {
  CreateMembershipBody,
  UpdateMembershipBody,
} from "../validator/membership.ts";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.ts";

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
      // Get hostId from context and if hostId exists (team access), get resources for that host
      const hostId = c.get("hostId");
      if (hostId) {
        const plans = await this.service.getMembershipsByUser(hostId, query);
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

      const planId = Number(c.req.param("id"));
      const plan = await this.service.getMembership(planId);

      if (!plan) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }

      if (plan.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
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

      const planId = Number(c.req.param("id"));
      const plan = await this.service.getMembership(planId);

      if (!plan) {
        return serveNotFound(c, ERRORS.MEMBERSHIP_NOT_FOUND);
      }
      if (plan.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }
      //if membership si lnked to any event, do not delete
      const events = await this.service.getEventsByMembership(planId);
      const hasActiveEvents = events.some(
        (event) => event.events.status === "active"
      );
      if (hasActiveEvents) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_LINKED_TO_EVENT);
      }

      await this.service.deleteMembership(planId);
      return c.json({ message: "Membership deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
