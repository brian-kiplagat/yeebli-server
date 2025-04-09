import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import type { EventService } from "../../service/event.js";
import type { LeadService } from "../../service/lead.js";
import type { UserService } from "../../service/user.js";
import type { UpdateEventBody } from "../validator/event.ts";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.js";
import env from "../../lib/env.js";
export class EventController {
  private service: EventService;
  private userService: UserService;
  private leadService: LeadService;

  constructor(
    service: EventService,
    userService: UserService,
    leadService: LeadService
  ) {
    this.service = service;
    this.userService = userService;
    this.leadService = leadService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public getEvents = async (c: Context) => {
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
        const events = await this.service.getAllEvents(query);
        return c.json(events);
      }

      const events = await this.service.getEventsByUser(user.id, query);
      return c.json(events);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getEvent = async (c: Context) => {
    try {
      const eventId = Number(c.req.param("id"));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }
      if (!event.asset) {
        return serveBadRequest(c, ERRORS.ASSET_NOT_FOUND);
      }

      return c.json(event);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public createEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body = await c.req.json();
      if (!body.dates || body.dates.length < 1) {
        return serveBadRequest(c, ERRORS.EVENT_DATE_REQUIRED);
      }
      const eventId = await this.service.createEvent({
        ...body,
        host_id: user.id,
      });

      return c.json(
        {
          message: "Event created successfully",
          link: `${env.FRONTEND_URL}/eventpage?code=${eventId[0].id}`,
          eventId: eventId[0].id,
        },
        201
      );
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public updateEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const eventId = Number(c.req.param("id"));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }
      //only and master role or admin or the owner of the event can update the event
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        event.host_id !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body: UpdateEventBody = await c.req.json();
      await this.service.updateEvent(eventId, body);

      return c.json({ message: "Event updated successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public cancelEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body = await c.req.json();
      const eventId = body.id;
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }
      //only and master role or admin or the owner of the event can update the event
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        event.host_id !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.cancelEvent(eventId, body.status);
      return c.json({ message: "Event cancelled successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const eventId = Number(c.req.param("id"));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }
      //check if the date id exists
      const date = await this.service.getEventDate(eventId);
      if (!date) {
        return serveBadRequest(c, ERRORS.EVENT_DATE_NOT_FOUND);
      }
      //only and master role or admin or the owner of the lead
      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        event.host_id !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }
      const leads = await this.leadService.findByEventId(eventId);
      if (leads.length > 0) {
        return serveBadRequest(c, ERRORS.EVENT_HAS_LEADS_CONNECTED);
      }

      await this.service.deleteEvent(eventId);
      return c.json({ message: "Event deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getEventDates = async (c: Context) => {
    try {
      const eventId = Number(c.req.param("id"));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }

      return c.json({ dates: event.dates });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteEventDate = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const eventId = Number(c.req.param("id"));
      const dateId = Number(c.req.param("dateId"));

      // Get the event details
      const event = await this.service.getEvent(eventId);
      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }

      // Check if this is the last date
      if (event.dates.length <= 1) {
        return serveBadRequest(c, ERRORS.CANNOT_DELETE_LAST_DATE);
      }

      if (
        user.role !== "master" &&
        user.role !== "owner" &&
        event.host_id !== user.id
      ) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.service.deleteEventDate(dateId);
      return c.json({ message: "Event date deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
