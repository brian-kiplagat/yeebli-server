import type { Context } from "hono";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../lib/logger.ts";
import type { NewLead } from "../../schema/schema.js";
import type { EventService } from "../../service/event.ts";
import type { LeadService } from "../../service/lead.js";
import type { TurnstileService } from "../../service/turnstile.js";
import type { UserService } from "../../service/user.ts";
import { sendTransactionalEmail } from "../../task/sendWelcomeEmail.ts";
import { externalFormSchema, LeadBody } from "../validator/lead.ts";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
} from "./resp/error.js";

export class LeadController {
  private service: LeadService;
  private userService: UserService;
  private eventService: EventService;
  private turnstileService: TurnstileService;

  constructor(
    service: LeadService,
    userService: UserService,
    eventService: EventService,
    turnstileService: TurnstileService
  ) {
    this.service = service;
    this.userService = userService;
    this.eventService = eventService;
    this.turnstileService = turnstileService;
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
        page: page ? Number.parseInt(page) : undefined,
        limit: limit ? Number.parseInt(limit) : undefined,
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
      if (!lead) {
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

      const body: LeadBody = await c.req.json();

      if (body.event_id) {
        if (!body.event_date_id) {
          return serveBadRequest(c, ERRORS.EVENT_DATE_ID_REQUIRED);
        }
      }
      //token is a random 6 digit number
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const lead = await this.service.create({
        ...body,
        userId: user.id,
        token,
      });
      if (lead && body.event_id) {
        const event = await this.eventService.getEvent(body.event_id);
        if (event) {
          const eventLink = `https://yeebli-e10656.webflow.io/eventpage?code=${event.id}&token=${token}&email=${body.email}`;
          sendTransactionalEmail(body.email, body.name, 1, {
            subject: `${event.event_name} - You've been invited`,
            title: `${event.event_name} - You've been invited`,
            subtitle: `You've been invited to join us`,
            body: `You've been invited to join us. Please use this link to access the event: ${eventLink}. Here is your passcode: ${token}`,
          });
        }
      }
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
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //only and master role or admin or the owner of the lead can update the lead
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        lead.userId !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
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
      if (!lead) {
        return serveBadRequest(c, ERRORS.LEAD_NOT_FOUND);
      }
      //only and master role or admin or the owner of the lead
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        lead.userId !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
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

      // Verify Turnstile token
      const ip = c.req.header("CF-Connecting-IP");
      const isValid = await this.turnstileService.verify(
        validatedData["cf-turnstile-response"],
        ip
      );

      if (!isValid) {
        return serveBadRequest(c, "Invalid Turnstile token");
      }

      const token = uuidv4();
      const event = await this.eventService.getEvent(validatedData.event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      const lead: NewLead = {
        name: validatedData.lead_form_name,
        email: validatedData.lead_form_email,
        phone: validatedData.lead_form_phone,
        event_id: validatedData.event_id,
        registered_date: validatedData.registered_date,
        host_id: validatedData.host_id,
        membership_level: "Silver",
        membership_active: false,
        form_identifier: "external_form",
        status_identifier: "Form",
        userId: validatedData.host_id,
        token: token,
        source_url: c.req.header("Referer") || "direct",
      };

      const createdLead = await this.service.create(lead);

      const eventLink = `https://yeebli-e10656.webflow.io/eventpage?code=${event.id}&token=${token}&email=${validatedData.lead_form_email}`;

      sendTransactionalEmail(
        validatedData.lead_form_email,
        validatedData.lead_form_name,
        1,
        {
          subject: "Welcome to the event",
          title: "Welcome to the event",
          subtitle: `You have been registered for the event`,
          body: `You have been registered for the event. Please use this link to access the event: ${eventLink}`,
        }
      );
      return c.json(
        {
          success: true,
          message: "Registration successful",
          leadId: createdLead[0].insertId,
        },
        201
      );
    } catch (error) {
      logger.error("Error handling external form:", error);
      return serveInternalServerError(c, error);
    }
  };
}
