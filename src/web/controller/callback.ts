import { Context } from "hono";
import type { CallbackService } from "../../service/callback.ts";
import type { NewCallback } from "../../schema/schema.ts";
import {
  callbackValidator,
  updateCallbackValidator,
  callbackQueryValidator,
  type CallbackBody,
  type UpdateCallbackBody,
  type CallbackQuery,
} from "../validator/callback.ts";
import {
  ERRORS,
  serveBadRequest,
  serveInternalServerError,
  serveNotFound,
} from "./resp/error.ts";
import { logger } from "../../lib/logger.ts";
import { UserService } from "../../service/user.ts";

export class CallbackController {
  private service: CallbackService;
  private userService: UserService;

  constructor(service: CallbackService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get("jwtPayload").email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  public createCallback = async (c: Context) => {
    try {
      

      const body: CallbackBody = await c.req.json();
      const callbackId = await this.service.createCallback({
        ...body,
        scheduled_time: body.scheduled_time
          ? new Date(body.scheduled_time)
          : null,
      });

      return c.json(
        {
          message: "Callback created successfully",
          callbackId: callbackId,
        },
        201
      );
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getCallback = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param("id"));
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

  public getCallbacksByLeadId = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const leadId = parseInt(c.req.param("leadId"));
      const callbacks = await this.service.getCallbacksByLeadId(leadId);
      return c.json(callbacks);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getUncalledCallbacks = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const callbacks = await this.service.getUncalledCallbacks();
      return c.json(callbacks);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

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

  public updateCallback = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param("id"));
      const body: UpdateCallbackBody = await c.req.json();

      await this.service.updateCallback(id, {
        ...body,
        scheduled_time: body.scheduled_time
          ? new Date(body.scheduled_time)
          : null,
      });

      return c.json({ message: "Callback updated successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteCallback = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param("id"));
      await this.service.deleteCallback(id);

      return c.json({ message: "Callback deleted successfully" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public markCallbackAsCalled = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param("id"));
      await this.service.markCallbackAsCalled(id);

      return c.json({ message: "Callback marked as called" });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
