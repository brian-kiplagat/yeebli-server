import type { Context } from "hono";
import { LeadService } from "../../service/lead.js";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.js";
import { UserService } from "../../service/user.ts";
import { logger } from "../../lib/logger.ts";
import { LeadBody } from "../validator/lead.ts";

export class LeadController {
  private service: LeadService;
  private userService: UserService;

  constructor(service: LeadService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public getLeads = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (user.role == "master") {
        //get all leads in db
        const leads = await this.service.getAllLeads();
        return c.json(leads);
      }
      const leads = await this.service.getLeadsByUser(user.id);
      return c.json(leads);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const leadId = Number(c.req.param("id"));
      const lead = await this.service.getLead(leadId);

      if (!lead) {
        return serveNotFound(c);
      }

      return c.json(lead);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public createLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      console.log({ user });
      const body = await c.req.json();

      await this.service.createLead({
        ...body,
        event_date: new Date(body.event_date),
        start_time: new Date(body.start_time),
        userId: user.id,
      });

      return c.json({ message: "Lead created successfully" }, 201);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updateLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const leadId = Number(c.req.param("id"));
      const lead = await this.service.getLead(leadId);

      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }

      const body = await c.req.json();
      await this.service.updateLead(leadId, {
        ...body,
        event_date: new Date(body.event_date),
        start_time: new Date(body.start_time),
      });

      return c.json({ message: "Lead updated successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteLead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const leadId = Number(c.req.param("id"));
      const lead = await this.service.getLead(leadId);

      if (!lead || lead.userId !== user.id) {
        return serveNotFound(c);
      }

      await this.service.deleteLead(leadId);
      return c.json({ message: "Lead deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
