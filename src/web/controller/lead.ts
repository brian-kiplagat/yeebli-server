import type { Context } from "hono";
import { logger } from "../../lib/logger.ts";
import type { LeadService } from "../../service/lead.js";
import type { UserService } from "../../service/user.ts";
import {
  LeadBody,
  ExternalFormBody,
  externalFormValidator,
} from "../validator/lead.ts";
import type { NewLead } from "../../schema/schema.js";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.js";
import { externalFormSchema } from "../validator/lead.ts";

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

      const { page, limit, search } = c.req.query();
      const query = {
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        search,
      };

      if (user.role === "master" || user.role === "owner") {
        const leads = await this.service.findAll(query);
        return c.json(leads);
      }

      const leads = await this.service.findByUserId(user.id, query);
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
      const lead = await this.service.find(leadId);
      if (!lead || lead.userId !== user.id) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
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

      const body = await c.req.json();
      const lead = await this.service.create({ ...body, userId: user.id });
      return c.json(lead, 201);
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
      const lead = await this.service.find(leadId);
      if (!lead || lead.userId !== user.id) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }

      const body = await c.req.json();
      await this.service.update(leadId, body);
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
      const lead = await this.service.find(leadId);
      if (!lead || lead.userId !== user.id) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }

      await this.service.delete(leadId);
      return c.json({ message: "Lead deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public handleExternalForm = async (c: Context) => {
    try {
      const formData = await c.req.parseBody();
      const validatedData = externalFormSchema.parse(formData);

      const lead: NewLead = {
        name: validatedData.lead_form_name,
        email: validatedData.lead_form_email,
        phone: validatedData.lead_form_phone,
        event_id: validatedData.event_id,
        host_id: validatedData.host_id,
        membership_level: "Silver",
        membership_active: false,
        form_identifier: "external_form",
        status_identifier: "Form",
        userId: validatedData.host_id,
      };

      const createdLead = await this.service.create(lead);

      return c.json(
        {
          success: true,
          message: "Registration successful",
          leadId: createdLead[0].insertId,
        },
        201
      );
    } catch (error) {
      logger.error(error);
      return c.json(
        {
          success: false,
          message: "Registration failed. Please try again.",
        },
        400
      );
    }
  };
}
