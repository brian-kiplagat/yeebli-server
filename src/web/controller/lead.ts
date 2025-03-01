import type { Context } from "hono";
import { LeadService } from "../../service/lead.js";
import { serveNotFound } from "./resp/error.js";

export class LeadController {
  private service: LeadService;

  constructor(service: LeadService) {
    this.service = service;
  }

  public getLeads = async (c: Context) => {
    const userId = c.get("jwtPayload").id;
    const leads = await this.service.getLeadsByUser(userId);
    return c.json(leads);
  };

  public getLead = async (c: Context) => {
    const userId = c.get("jwtPayload").id;
    const leadId = Number(c.req.param("id"));
    const lead = await this.service.getLead(leadId);

    if (!lead || lead.userId !== userId) {
      return serveNotFound(c);
    }

    return c.json(lead);
  };

  public createLead = async (c: Context) => {
    const userId = c.get("jwtPayload").id;
    const data = await c.req.json();

    await this.service.createLead({
      ...data,
      userId,
    });

    return c.json({ message: "Lead created successfully" }, 201);
  };

  public updateLead = async (c: Context) => {
    const userId = c.get("jwtPayload").id;
    const leadId = Number(c.req.param("id"));
    const lead = await this.service.getLead(leadId);

    if (!lead || lead.userId !== userId) {
      return serveNotFound(c);
    }

    const data = await c.req.json();
    await this.service.updateLead(leadId, data);

    return c.json({ message: "Lead updated successfully" });
  };

  public deleteLead = async (c: Context) => {
    const userId = c.get("jwtPayload").id;
    const leadId = Number(c.req.param("id"));
    const lead = await this.service.getLead(leadId);

    if (!lead || lead.userId !== userId) {
      return serveNotFound(c);
    }

    await this.service.deleteLead(leadId);
    return c.json({ message: "Lead deleted successfully" });
  };
}
