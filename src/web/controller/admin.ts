import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { AdminService } from "../../service/admin.js";
import type { UserService } from "../../service/user.js";
import type { AssetService } from "../../service/asset.js";
import type { EventService } from "../../service/event.js";
import type { LeadService } from "../../service/lead.js";
import {
  adminEventQuerySchema,
  adminLeadQuerySchema,
  adminUserQuerySchema,
  adminUserDetailsQuerySchema,
  adminUpdateUserSchema,
  adminCreateUserSchema,
  AdminCreateUserBody,
} from "../validator/admin.js";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
} from "./resp/error.js";

export class AdminController {
  private service: AdminService;
  private userService: UserService;
  private eventService: EventService;
  private leadService: LeadService;
  private assetService: AssetService;

  constructor(
    service: AdminService,
    userService: UserService,
    eventService: EventService,
    leadService: LeadService,
    assetService: AssetService
  ) {
    this.service = service;
    this.userService = userService;
    this.eventService = eventService;
    this.leadService = leadService;
    this.assetService = assetService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  private async checkAdminAccess(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
    }
    if (user.role !== "master") {
      return serveBadRequest(c, "Unauthorized: Admin access required");
    }
    return user;
  }

  public getUsers = async (c: Context) => {
    try {
      const user = await this.checkAdminAccess(c);
      if (!user) return;

      const query = adminUserQuerySchema.parse(c.req.query());
      const result = await this.service.getUsers(query);
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getParticularUser = async (c: Context) => {
    try {
      const admin = await this.checkAdminAccess(c);
      if (!admin) return;

      const userId = Number(c.req.param("id"));
      const query = adminUserDetailsQuerySchema.parse(c.req.query());

      // Get base user data
      const user = await this.userService.find(userId);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Prepare response object
      const response: any = { ...user };

      // Use existing service methods instead of duplicating repository queries
      if (query.include_events) {
        const events = await this.eventService.getEventsByUser(userId, {
          page: query.page,
          limit: query.limit,
        });
        response.events = events;
      }

      if (query.include_leads) {
        const leads = await this.leadService.findByUserId(userId, {
          page: query.page,
          limit: query.limit,
        });
        response.leads = leads;
      }

      if (query.include_assets) {
        const assets = await this.assetService.getAssetsByUser(userId, {
          page: query.page,
          limit: query.limit,
        });
        response.assets = assets;
      }

      return c.json(response);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updateParticularUser = async (c: Context) => {
    try {
      const admin = await this.checkAdminAccess(c);
      if (!admin) return;

      const userId = Number(c.req.param("id"));

      // Check if user exists
      const user = await this.userService.find(userId);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      // Validate update data
      const body = await c.req.json();
      const updateData = adminUpdateUserSchema.parse(body);

      // Use existing user service to update
      await this.userService.update(userId, updateData);

      // Get updated user data
      const updatedUser = await this.userService.find(userId);

      return c.json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getLeads = async (c: Context) => {
    try {
      const user = await this.checkAdminAccess(c);
      if (!user) return;

      const query = adminLeadQuerySchema.parse(c.req.query());
      const result = await this.service.getLeads(query);
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getEvents = async (c: Context) => {
    try {
      const user = await this.checkAdminAccess(c);
      if (!user) return;

      const query = adminEventQuerySchema.parse(c.req.query());
      const result = await this.service.getEvents(query);
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public createUser = async (c: Context) => {
    try {
      const admin = await this.checkAdminAccess(c);
      if (!admin) return;

      const body: AdminCreateUserBody = await c.req.json();
      const { name, email, role, phone } = adminCreateUserSchema.parse(body);

      // Check if user with email already exists
      const existingUser = await this.userService.findByEmail(email);
      if (existingUser) {
        return serveBadRequest(c, "User with this email already exists");
      }

      // Create the user using userService
      const newUser = await this.userService.create(name, email, 'Admin@12356', role, phone);

      return c.json({
        message: "User created successfully",
        user: newUser,
      });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteUser = async (c: Context) => {
    try {
      const user = await this.checkAdminAccess(c);
      if (!user) return;

      const id = c.req.param("id");
      const foundUser = await this.userService.find(Number(id));
      if (!foundUser) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const result = await this.userService.delete(Number(id));
      return c.json({ message: "User deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
