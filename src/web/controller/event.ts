import type { Context } from 'hono';
import { logger } from '../../lib/logger.js';
import type { EventService } from '../../service/event.js';
import type { UserService } from '../../service/user.js';
import { ERRORS, serveBadRequest, serveInternalServerError, serveNotFound } from './resp/error.js';

export class EventController {
  private service: EventService;
  private userService: UserService;

  constructor(service: EventService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get('jwtPayload').email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public getEvents = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      if (user.role === 'master') {
        const events = await this.service.getAllEvents();
        return c.json(events);
      }

      const events = await this.service.getEventsByUser(user.id);
      return c.json(events);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getEvent = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const eventId = Number(c.req.param('id'));
      const event = await this.service.getEvent(eventId);

      if (!event || (user.role !== 'master' && event.host_id !== user.id)) {
        return serveNotFound(c);
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
      await this.service.createEvent({
        ...body,
        host_id: user.id,
        lead_id: body.lead_id,
      });

      return c.json({ message: 'Event created successfully' }, 201);
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

      if (!event || (user.role !== 'master' && event.host_id !== user.id)) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      const body = await c.req.json();
      await this.service.updateEvent(eventId, body);

      return c.json({ message: 'Event updated successfully' });
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

      if (!event || (user.role !== 'master' && event.host_id !== user.id)) {
        return serveNotFound(c);
      }

      await this.service.deleteEvent(eventId);
      return c.json({ message: 'Event deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
