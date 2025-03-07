import type { Context } from 'hono';
import { logger } from '../../lib/logger.js';
import type { AdminService } from '../../service/admin.js';
import type { UserService } from '../../service/user.js';
import { adminEventQuerySchema, adminLeadQuerySchema, adminUserQuerySchema } from '../validator/admin.js';
import { ERRORS, serveBadRequest, serveInternalServerError } from './resp/error.js';

export class AdminController {
  private service: AdminService;
  private userService: UserService;

  constructor(service: AdminService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  private async getUser(c: Context) {
    const email = c.get('jwtPayload').email;
    const user = await this.userService.findByEmail(email);
    return user;
  }

  private async checkAdminAccess(c: Context) {
    const user = await this.getUser(c);
    if (!user) {
      return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
    }
    if (user.role !== 'master') {
      return serveBadRequest(c, 'Unauthorized: Admin access required');
    }
    return user;
  }

  public getUsers = async (c: Context) => {
    try {
      const user = await this.checkAdminAccess(c);
      if (!user) return;

      const query = adminUserQuerySchema.parse(c.req.query());
      const result = await this.service.getUsers(query);
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getLeads = async (c: Context) => {
    try {
      const user = await this.checkAdminAccess(c);
      if (!user) return;

      const query = adminLeadQuerySchema.parse(c.req.query());
      const result = await this.service.getLeads(query);
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public getEvents = async (c: Context) => {
    try {
      const user = await this.checkAdminAccess(c);
      if (!user) return;

      const query = adminEventQuerySchema.parse(c.req.query());
      const result = await this.service.getEvents(query);
      return c.json(result);
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };

  public deleteUser = async (c: Context) => {
    try {
      const user = await this.checkAdminAccess(c);
      if (!user) return;

      const id = c.req.param('id');
      const foundUser = await this.userService.find(Number(id));
      if (!foundUser) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const result = await this.userService.delete(Number(id));
      return c.json({ message: 'User deleted successfully' });
    } catch (error) {
      logger.error(error);
      return serveInternalServerError(c, error);
    }
  };
}
