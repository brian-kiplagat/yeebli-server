import { Context } from 'hono';

import { logger } from '../../lib/logger.ts';
import type { CallbackService } from '../../service/callback.ts';
import { EventService } from '../../service/event.ts';
import { UserService } from '../../service/user.ts';
import { type CallbackBody, type UpdateCallbackBody } from '../validator/callback.ts';
import { ERRORS, serveBadRequest, serveInternalServerError, serveNotFound } from './resp/error.ts';

export class CallbackController {
  private service: CallbackService;
  private userService: UserService;
  private eventService: EventService;

  constructor(service: CallbackService, userService: UserService, eventService: EventService) {
    this.service = service;
    this.userService = userService;
    this.eventService = eventService;
  }

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private getUser = async (c: Context) => {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  };

  /**
   * Creates a new callback request for an event
   * @param {Context} c - The Hono context containing callback details
   * @returns {Promise<Response>} Response containing created callback information
   * @throws {Error} When callback creation fails or validation fails
   */
  public createCallback = async (c: Context) => {
    try {
      const body: CallbackBody = await c.req.json();

      //a lead can only create one callback per event and callback type
      const existingCallback = await this.service.getCallbackByLeadIdAndEventIdAndCallbackType(
        body.lead_id,
        body.event_id,
        body.callback_type,
      );
      if (existingCallback) {
        return serveBadRequest(c, ERRORS.CALLBACK_ALREADY_EXISTS);
      }

      //confirm the event exists
      const event = await this.eventService.getEvent(body.event_id);
      if (!event) {
        return serveBadRequest(c, ERRORS.EVENT_NOT_FOUND);
      }

      const callbackId = await this.service.createCallback({
        ...body,
        host_id: event.host_id,
      });

      return c.json(
        {
          message: 'Callback created successfully',
          callbackId: callbackId,
        },
        201,
      );
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves detailed information about a specific callback
   * @param {Context} c - The Hono context containing callback ID
   * @returns {Promise<Response>} Response containing callback details
   * @throws {Error} When fetching callback details fails
   */
  public getCallback = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const callback = await this.service.getCallback(id);

      if (!callback) {
        return serveNotFound(c, ERRORS.CALLBACK_NOT_FOUND);
      }

      return c.json(callback);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all callbacks for a specific lead
   * @param {Context} c - The Hono context containing lead ID
   * @returns {Promise<Response>} Response containing list of callbacks
   * @throws {Error} When fetching callbacks fails
   */
  public getCallbacksByLeadId = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const leadId = parseInt(c.req.param('leadId'));
      const callbacks = await this.service.getCallbacksByLeadId(leadId);
      return c.json(callbacks);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all uncalled callbacks for the current user
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing list of uncalled callbacks
   * @throws {Error} When fetching callbacks fails
   */
  public getUncalledCallbacks = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const callbacks = await this.service.getUncalledCallbacks(user.id);
      return c.json(callbacks);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Retrieves all scheduled callbacks
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing list of scheduled callbacks
   * @throws {Error} When fetching callbacks fails
   */
  public getScheduledCallbacks = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const callbacks = await this.service.getScheduledCallbacks();
      return c.json(callbacks);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Updates an existing callback's details
   * @param {Context} c - The Hono context containing updated callback information
   * @returns {Promise<Response>} Response indicating update status
   * @throws {Error} When callback update fails
   */
  public updateCallback = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const body: UpdateCallbackBody = await c.req.json();

      await this.service.updateCallback(id, {
        ...body,
      });

      return c.json({ message: 'Callback updated successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Deletes a callback from the system
   * @param {Context} c - The Hono context containing callback ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When callback deletion fails
   */
  public deleteCallback = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      await this.service.deleteCallback(id);

      return c.json({ message: 'Callback deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  /**
   * Marks a callback as completed/called
   * @param {Context} c - The Hono context containing callback ID
   * @returns {Promise<Response>} Response indicating status update
   * @throws {Error} When status update fails
   */
  public markCallbackAsCalled = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      await this.service.markCallbackAsCalled(id);

      return c.json({ message: 'Callback marked as called' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
