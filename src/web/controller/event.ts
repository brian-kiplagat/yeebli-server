import type { Context } from 'hono';

import env from '../../lib/env.js';
import { logger } from '../../lib/logger.js';
import type { EventService } from '../../service/event.js';
import type { LeadService } from '../../service/lead.js';
import type { UserService } from '../../service/user.js';
import type { CreateEventBody, UpdateEventBody } from '../validator/event.ts';
import { ERRORS, serveBadRequest, serveInternalServerError, serveNotFound } from './resp/error.js';
export class EventController {
  private service: EventService;
  private userService: UserService;
  private leadService: LeadService;

  constructor(service: EventService, userService: UserService, leadService: LeadService) {
    this.service = service;
    this.userService = userService;
    this.leadService = leadService;
  }

  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
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

      if (user.role === 'master' || user.role === 'owner') {
        const events = await this.service.getAllEvents(query);
        return c.json(events);
      }
      // Get hostId from context and if hostId exists (team access), get resources for that host
      const hostId = c.get('hostId');
      if (hostId) {
        const events = await this.service.getEventsByUser(hostId, query);
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
      const eventId = Number(c.req.param('id'));
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
      const body: CreateEventBody = await c.req.json();

      const membership_ids = body.memberships;
      if (membership_ids.length < 1) {
        return serveBadRequest(c, ERRORS.MEMBERSHIP_REQUIRED);
      }
      const eventId = await this.service.createEvent(
        {
          ...body,
          host_id: user.id,
        },
        membership_ids,
      );

      return c.json(
        {
          message: 'Event created successfully',
          link: `${env.FRONTEND_URL}/events/event?code=${eventId}`,
          eventId: eventId,
        },
        201,
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

      const eventId = Number(c.req.param('id'));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      //only and master role or admin or the owner of the event can update the event
      if (user.role !== 'master' && user.role !== 'owner' && event.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const body: UpdateEventBody = await c.req.json();
      const { memberships, ...rest } = body;
      await this.service.updateEvent(eventId, { ...rest, memberships });

      return c.json({ message: 'Event updated successfully' });
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
      if (user.role !== 'master' && user.role !== 'owner' && event.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      if (event.status === 'cancelled') {
        return serveBadRequest(c, ERRORS.EVENT_ALREADY_CANCELLED);
      }

      const host = await this.userService.find(event.host_id);
      if (!host) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      await this.service.cancelEvent(eventId, body.status);
      //inform all attendees that the event has been cancelled
      await this.service.informAttendees(event, {
        subject: 'Event Cancelled',
        title: 'Event Cancelled',
        subtitle: `The event "${event.event_name}" has been cancelled.`,
        body: `We're sorry to inform you that the event "${event.event_name}" has been cancelled by the host. If you'd like a refund, please contact the host directly at ${host.email} or ${host.phone} and provide your booking details.`,
      });
      return c.json({ message: 'Event cancelled successfully' });
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

      const eventId = Number(c.req.param('id'));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }

      //only and master role or admin or the owner of the lead
      if (user.role !== 'master' && user.role !== 'owner' && event.host_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }
      const leads = await this.leadService.findByEventId(eventId);
      if (leads.length > 0) {
        return serveBadRequest(c, ERRORS.EVENT_HAS_LEADS_CONNECTED);
      }

      await this.service.deleteEvent(eventId);
      return c.json({ message: 'Event deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getEventMemberships = async (c: Context) => {
    try {
      const eventId = Number(c.req.param('id'));
      const event = await this.service.getEvent(eventId);

      if (!event) {
        return serveNotFound(c, ERRORS.EVENT_NOT_FOUND);
      }

      const memberships = await this.service.getMembershipsByEventId(eventId);
      return c.json(memberships);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
