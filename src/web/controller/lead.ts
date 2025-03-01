import type { Context } from "hono";
import { LeadService } from "../../service/lead.js";
import { ERRORS, serveBadRequest, serveNotFound } from "./resp/error.js";
import { UserService } from "../../service/user.ts";

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
    const user = await this.getUser(c);
    if (!user) {
      return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
    }

    const leads = await this.service.getLeadsByUser(user.id);
    return c.json(leads);
  };

  public getLead = async (c: Context) => {
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
  };

  public createLead = async (c: Context) => {
    const user = await this.getUser(c);
    if (!user) {
      return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
    }
    const data = await c.req.json();

    await this.service.createLead({
      ...data,
      userId: user.id,
    });

    return c.json({ message: "Lead created successfully" }, 201);
  };

  public updateLead = async (c: Context) => {
    const user = await this.getUser(c);
    if (!user) {
      return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
    }
    const leadId = Number(c.req.param("id"));
    const lead = await this.service.getLead(leadId);

    if (!lead || lead.userId !== user.id) {
      return serveNotFound(c);
    }

    const data = await c.req.json();
    await this.service.updateLead(leadId, data);

    return c.json({ message: "Lead updated successfully" });
  };

  public deleteLead = async (c: Context) => {
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
  };
}
